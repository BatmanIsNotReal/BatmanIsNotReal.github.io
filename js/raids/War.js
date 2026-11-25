// The war: raiding outposts, raids, battles, and the buildings that get taken and retaken.
// The numbers are in rules.mjs. This file keeps the state (it is saved with the game) and moves things on
// the map. Time is counted in rounds of 10 seconds and only runs while the game is open.
import {
	MARCH_ROUNDS, FORT_RADIUS, STRENGTH_FLOOR_LEVEL, GRACE_ROUNDS, UNIT_POWER, FACTIONS, TILE, GARRISON,
	baseStrength, maxOutposts, outpostCap, guardPenalty, guardCancelChance, warnLead, resolveBattle, unitsLost,
	describeStrength, loot,
} from "./rules.mjs";

// What raiders go for: huts, mines, farms, lumber mills, blood temples and the defences
const TARGET_TILES = [1, 4, 5, 7, 8, TILE.WATCH_TOWER, TILE.GUARD_OUTPOST, TILE.FORT];
const OWN_TILES = TARGET_TILES;

export default class War {
	// options: {
	//   town, inventory, familiars, army: [{ key, vampire }], getLevel(), document,
	//   say(text)           a line in the Updates list
	//   report(title, lines) a battle report window
	//   alarm()             a sound for warnings
	//   reward(loot)        gives the loot and influence to the player
	//   random
	// }
	constructor(options) {
		Object.assign(this, options);
		this.random = options.random || Math.random;
		this.outposts = [];   // { id, faction, strength, raids, nextRaid }
		this.held = {};       // tile id -> { type, level, freed, room, by, garrison }
		this.damage = {};     // tile id -> 0..1 (how hurt a defence building is)
		this.raid = null;     // { outpost, target, strength, left, warned }
		this.nextOutpost = null;
	}

	// ---------- saving ----------
	toJSON() {
		return { outposts: this.outposts, held: this.held, damage: this.damage, raid: this.raid, nextOutpost: this.nextOutpost };
	}

	load(saved) {
		this.outposts = []; this.held = {}; this.damage = {}; this.raid = null; this.nextOutpost = null;
		if (!saved || typeof saved !== "object") return;
		const isId = (id) => typeof id === "string" && /^tile\d+$/.test(id);
		const num = (v, d = 0) => (Number.isFinite(v) ? v : d);
		for (const o of Array.isArray(saved.outposts) ? saved.outposts : []) {
			if (isId(o.id) && FACTIONS[o.faction]) this.outposts.push({ id: o.id, faction: o.faction, strength: Math.max(1, num(o.strength, 5)), raids: Math.max(0, Math.floor(num(o.raids))), nextRaid: Math.max(1, num(o.nextRaid, 60)) });
		}
		for (const [id, h] of Object.entries(saved.held && typeof saved.held === "object" ? saved.held : {})) {
			if (isId(id) && h && Number.isInteger(h.type)) this.held[id] = { type: h.type, level: Math.max(0, Math.floor(num(h.level))), freed: Math.max(0, num(h.freed)), room: Math.max(0, num(h.room)), by: h.by || null, garrison: Math.max(0, num(h.garrison)) };
		}
		for (const [id, v] of Object.entries(saved.damage && typeof saved.damage === "object" ? saved.damage : {})) if (isId(id) && v > 0) this.damage[id] = Math.min(1, num(v));
		const r = saved.raid;
		if (r && isId(r.target) && this.outposts.some((o) => o.id === r.outpost)) this.raid = { outpost: r.outpost, target: r.target, strength: Math.max(0, num(r.strength)), left: Math.max(0, num(r.left, 1)), warned: !!r.warned };
		this.nextOutpost = Number.isFinite(saved.nextOutpost) ? saved.nextOutpost : null;
	}

	// ---------- the map ----------
	get width() { return this.town.mapWidth; }
	xy(id) { const n = Number(id.slice(4)); return { x: n % this.width, y: Math.floor(n / this.width) }; }
	dist(a, b) { const p = this.xy(a), q = this.xy(b); return Math.hypot(p.x - q.x, p.y - q.y); }
	idsOfType(types) {
		const list = Array.isArray(types) ? types : [types];
		return Object.keys(this.town.tiles).filter((id) => list.includes(this.town.tiles[id]));
	}
	count(type) { return this.idsOfType(type).length; }
	setTile(id, type) {
		this.town.tiles[id] = type;
		const img = this.document.getElementById(id);
		const src = this.town.tileImage(type);
		if (img && src) img.src = String(src);
	}
	levelNow() { return Math.max(1, this.getLevel()); }

	// ---------- the army ----------
	armyPower(share = 1) {
		return this.army.reduce((sum, u) => sum + u.vampire.ammount * (UNIT_POWER[u.key] || 0), 0) * share;
	}
	armyCount() { return this.army.reduce((sum, u) => sum + u.vampire.ammount, 0); }
	// share of the army fights (1 = everybody); rate = how many of those die. Returns how many died.
	loseUnits(share, rate) {
		let lost = 0;
		for (const u of this.army) {
			const sent = Math.round(u.vampire.ammount * share);
			const dead = unitsLost(sent, rate, this.random);
			u.vampire.ammount -= dead;
			lost += dead;
		}
		return lost;
	}

	// ---------- defences ----------
	towers() { return this.idsOfType(TILE.WATCH_TOWER).length; }
	guards() { return this.idsOfType(TILE.GUARD_OUTPOST).length; }
	garrisonOf(id) {
		const type = this.town.tiles[id];
		return GARRISON[type] ? baseStrength(this.levelNow()) * GARRISON[type] * (1 - (this.damage[id] || 0)) : 0;
	}
	// Forts that protect a tile (within their radius, not worn down completely)
	fortsCovering(id) {
		return this.idsOfType(TILE.FORT).filter((f) => f !== id && (this.damage[f] || 0) < 1 && this.dist(f, id) <= FORT_RADIUS);
	}
	nameOf(id) {
		const key = this.town.buildingKey(id);
		return key ? this.town.Buildings[key].name.toLowerCase() : "building";
	}

	// ---------- every round ----------
	updateTen() {
		const level = this.levelNow();
		this.reconcile();
		for (const id of Object.keys(this.damage)) {
			this.damage[id] = Math.max(0, this.damage[id] - 0.01);
			if (this.damage[id] <= 0) delete this.damage[id];
		}
		this.spawnOutposts(level);
		for (const o of this.outposts) {
			const cap = outpostCap(level, o.faction, o.raids);
			if (!(this.raid && this.raid.outpost === o.id)) o.strength = Math.min(cap, o.strength + cap * 0.004);
			if (this.raid && this.raid.outpost === o.id) continue;
			o.nextRaid--;
			if (o.nextRaid <= 0) {
				if (this.raid) o.nextRaid = 6; // one raid at a time
				else this.launch(o);
			}
		}
		if (this.raid) this.marchOn();
	}

	// Makes the map and the war agree (a tile that says outpost has to have one, and so on)
	reconcile() {
		const tiles = this.town.tiles;
		for (const id of Object.keys(tiles)) {
			if (tiles[id] === TILE.OUTPOST && !this.outposts.some((o) => o.id === id)) this.setTile(id, 0);
			if (tiles[id] === TILE.HELD && !this.held[id]) this.setTile(id, 0);
		}
		this.outposts = this.outposts.filter((o) => tiles[o.id] === TILE.OUTPOST);
		for (const id of Object.keys(this.held)) if (tiles[id] !== TILE.HELD) delete this.held[id];
		if (this.raid && !this.outposts.some((o) => o.id === this.raid.outpost)) this.raid = null;
	}

	buildingCount() { return this.idsOfType(OWN_TILES).length; }

	spawnOutposts(level) {
		const wanted = level >= STRENGTH_FLOOR_LEVEL && this.buildingCount() >= 3 && this.outposts.length < maxOutposts(level);
		if (!wanted) { if (this.outposts.length >= maxOutposts(level)) this.nextOutpost = null; return; }
		if (this.nextOutpost === null) this.nextOutpost = this.outposts.length === 0 ? GRACE_ROUNDS : 150 + Math.floor(this.random() * 100);
		this.nextOutpost--;
		if (this.nextOutpost <= 0) { this.nextOutpost = null; this.buildOutpost(level); }
	}

	buildOutpost(level) {
		const mine = this.idsOfType(OWN_TILES);
		const grass = this.idsOfType(0);
		if (!mine.length || !grass.length) return;
		const near = (id) => Math.min(...mine.map((m) => this.dist(m, id)));
		const scored = grass.map((id) => ({ id, d: near(id) }));
		let pool = scored.filter((c) => c.d >= 5 && c.d <= 14);
		if (!pool.length) pool = scored.filter((c) => c.d >= 3);
		if (!pool.length) pool = scored;
		const spot = pool[Math.floor(this.random() * pool.length)].id;
		const kinds = level < 8 ? ["bandits"] : level < 12 ? ["bandits", "nest"] : ["bandits", "nest", "clan"];
		const faction = kinds[Math.floor(this.random() * kinds.length)];
		const f = FACTIONS[faction];
		this.outposts.push({ id: spot, faction, strength: outpostCap(level, faction, 0) * 0.8, raids: 0, nextRaid: Math.round(f.every[0] + this.random() * (f.every[1] - f.every[0])) });
		this.setTile(spot, TILE.OUTPOST);
		this.say(`Scouts report that ${f.what} has built a raiding outpost ${this.bearing(spot)} of your town. It will send raiders. Destroy it with your army, and raise watch towers, guard outposts and forts.`);
		this.alarm?.();
	}

	// Which way from the middle of your buildings
	bearing(id) {
		const mine = this.idsOfType(OWN_TILES).map((m) => this.xy(m));
		const cx = mine.reduce((s, p) => s + p.x, 0) / Math.max(1, mine.length), cy = mine.reduce((s, p) => s + p.y, 0) / Math.max(1, mine.length);
		const p = this.xy(id);
		const dx = p.x - cx, dy = p.y - cy;
		if (Math.hypot(dx, dy) < 2) return "right next to";
		const angle = Math.atan2(dy, dx); // 0 = east, down = south
		const names = ["east", "south-east", "south", "south-west", "west", "north-west", "north", "north-east"];
		return "to the " + names[(Math.round(angle / (Math.PI / 4)) + 8) % 8];
	}

	interval(o) {
		const f = FACTIONS[o.faction];
		return Math.round(f.every[0] + this.random() * (f.every[1] - f.every[0]));
	}

	pickTarget(o) {
		const list = this.idsOfType(TARGET_TILES).sort((a, b) => this.dist(a, o.id) - this.dist(b, o.id));
		if (!list.length) return null;
		return list[this.random() < 0.7 || list.length < 2 ? 0 : 1];
	}

	launch(o) {
		const guards = this.guards();
		if (this.random() < guardCancelChance(guards)) {
			this.say(`Your guard outposts turned back a raiding party from ${FACTIONS[o.faction].name} before it could set out.`);
			o.nextRaid = this.interval(o);
			return;
		}
		const target = this.pickTarget(o);
		if (!target) { o.nextRaid = this.interval(o); return; }
		const sent = o.strength * 0.6 * (0.8 + 0.4 * this.random());
		o.strength -= sent;
		this.raid = { outpost: o.id, target, strength: sent * guardPenalty(guards), left: MARCH_ROUNDS, warned: false };
	}

	marchOn() {
		const r = this.raid;
		r.left--;
		const lead = warnLead(this.towers());
		if (!r.warned && lead > 0 && r.left <= lead) {
			r.warned = true;
			const o = this.outposts.find((x) => x.id === r.outpost);
			const seconds = Math.max(0, r.left) * 10;
			this.say(`Your watch tower sounds the alarm: raiders from ${FACTIONS[o.faction].name} are marching on your ${this.nameOf(r.target)}! Strength ${describeStrength(r.strength, true)}, arriving in about ${seconds} seconds. Your army has power ${Math.round(this.armyPower()).toLocaleString("en-US")}.`);
			this.alarm?.();
		}
		if (r.left <= 0) this.resolveRaid();
	}

	// ---------- the raid arrives ----------
	resolveRaid() {
		const r = this.raid;
		this.raid = null;
		const o = this.outposts.find((x) => x.id === r.outpost);
		if (!o) return;
		let target = r.target;
		if (!TARGET_TILES.includes(this.town.tiles[target])) target = this.pickTarget(o);
		const f = FACTIONS[o.faction];
		o.raids++;
		o.nextRaid = this.interval(o);
		if (!target) { o.strength += r.strength; return; }
		const type = this.town.tiles[target];
		const covering = this.fortsCovering(target);
		const army = this.armyPower();
		const garrison = this.garrisonOf(target) + covering.reduce((sum, id) => sum + this.garrisonOf(id), 0);
		const defence = army + garrison;
		const what = this.nameOf(target);
		const result = resolveBattle(r.strength, defence, this.random);
		const lines = [`${f.name[0].toUpperCase() + f.name.slice(1)} attacked your ${what} with strength ${describeStrength(r.strength, true)}.`,
			`Defending: your army (power ${Math.round(army).toLocaleString("en-US")})` + (garrison > 0 ? ` and garrisons (power ${Math.round(garrison).toLocaleString("en-US")})` : "") + ".",
		];
		const lost = this.loseUnits(1, result.defenderLoss);
		// A garrison that held is worn down a bit (a garrison that lost is handled below)
		if (!result.attackerWins) for (const id of [target, ...covering]) if (this.garrisonOf(id) > 0) this.damage[id] = Math.min(1, (this.damage[id] || 0) + result.defenderLoss * 0.8);
		const survivors = r.strength * (1 - result.attackerLoss);
		let title;
		if (!result.attackerWins) {
			title = "Raid repelled";
			o.strength += survivors;
			lines.push(`Your defenders won. The raiders lost ${Math.round(result.attackerLoss * 100)}% of their force and fled home.`);
		} else if (covering.length) {
			const fort = covering[0];
			this.damage[fort] = Math.min(1, (this.damage[fort] || 0) + 0.6);
			if (this.damage[fort] >= 1) {
				title = "A fort has fallen";
				this.capture(fort, o.id, survivors * 0.5);
				o.strength += survivors * 0.5;
				lines.push(`The raiders broke the fort. It is now held by the enemy.`);
			} else {
				title = "Raid broke on the fort";
				o.strength += survivors;
				lines.push(`The raiders beat your army, but the fort's walls held and your ${what} was spared. The fort is badly damaged (${Math.round(this.damage[fort] * 100)}%).`);
			}
		} else {
			title = "Building taken";
			this.capture(target, o.id, survivors * 0.5);
			o.strength += survivors * 0.5;
			lines.push(`The raiders won and took your ${what}. It stops working until you retake it (click it on the map).`);
		}
		lines.push(lost > 0 ? `Your army lost ${lost.toLocaleString("en-US")} units.` : "Your army lost no units.");
		for (const line of lines) this.say(line);
		this.alarm?.();
		this.report?.(title, lines);
	}

	// ---------- taking and retaking buildings ----------
	capture(id, by, garrison) {
		const info = this.town.demolishInfo(id, this.familiars);
		if (!info) return;
		const type = this.town.tiles[id];
		this.town.Buildings[info.key].ammount = Math.max(0, this.town.Buildings[info.key].ammount - 1);
		this.familiars.notWorking += info.freed;
		this.familiars.addMaxLimit(-info.room);
		let killed = 0;
		// Familiars without a home die: first the idle ones, then gatherers
		let overflow = Math.max(0, this.familiars.ammount - this.familiars.getMaxLimit());
		for (const field of ["notWorking", "foodGather", "woodGather", "bloodGather"]) {
			const take = Math.min(overflow, Math.max(0, this.familiars[field] || 0));
			this.familiars[field] = (this.familiars[field] || 0) - take;
			this.familiars.ammount -= take;
			killed += take;
			overflow -= take;
		}
		this.held[id] = { type, level: info.level, freed: info.freed, room: info.room, by, garrison };
		delete this.town.tileLevels[id];
		delete this.damage[id];
		this.setTile(id, TILE.HELD);
		if (killed > 0) this.say(`${killed.toLocaleString("en-US")} familiars died when the raiders took the building.`);
	}

	restore(id) {
		const h = this.held[id];
		if (!h) return;
		delete this.held[id];
		this.setTile(id, h.type);
		const key = this.town.buildingKey(id);
		if (key) this.town.Buildings[key].ammount++;
		this.familiars.addMaxLimit(h.room);
		this.familiars.notWorking = Math.max(0, this.familiars.notWorking - h.freed);
		if (h.level > 0) this.town.tileLevels[id] = h.level;
	}

	// ---------- your attacks ----------
	// share: how much of the army goes (0.25 .. 1)
	attackOutpost(id, share) {
		const o = this.outposts.find((x) => x.id === id);
		if (!o) return { ok: false, lines: ["There is no outpost here."] };
		const send = this.armyPower(share);
		if (send <= 0) return { ok: false, lines: ["You have no vampires to send."] };
		const f = FACTIONS[o.faction];
		const result = resolveBattle(send, o.strength * 1.25, this.random); // a camp is easier to defend
		const lost = this.loseUnits(share, result.attackerLoss);
		const lines = [`Your army (power ${Math.round(send).toLocaleString("en-US")}) attacked the outpost of ${f.name}.`];
		if (result.attackerWins) {
			this.setTile(id, 0);
			this.outposts = this.outposts.filter((x) => x !== o);
			let freed = 0;
			for (const hid of Object.keys(this.held)) if (this.held[hid].by === id) { this.restore(hid); freed++; }
			if (this.raid && this.raid.outpost === id) { this.raid = null; lines.push("The raiders on the march have lost their home and scatter."); }
			const prize = loot(o.strength);
			this.reward(prize);
			if (this.nextOutpost === null) this.nextOutpost = 90 + Math.floor(this.random() * 60);
			lines.push(`Victory! The outpost is destroyed and its raids stop.`);
			if (freed) lines.push(`${freed} of your buildings were freed.`);
			lines.push(`Loot: ${prize.wood.toLocaleString("en-US")} wood, ${prize.iron.toLocaleString("en-US")} iron, ${prize.bronze.toLocaleString("en-US")} bronze, ${prize.gold.toLocaleString("en-US")} gold and ${prize.xp.toLocaleString("en-US")} influence.`);
		} else {
			o.strength = Math.max(1, o.strength * (1 - result.defenderLoss));
			lines.push(`Defeat. The camp held, but it is weaker now. Try again with a larger force.`);
		}
		lines.push(lost > 0 ? `You lost ${lost.toLocaleString("en-US")} units.` : "You lost no units.");
		return { ok: true, won: result.attackerWins, lines };
	}

	retake(id, share) {
		const h = this.held[id];
		if (!h) return { ok: false, lines: ["Nothing is held here."] };
		const send = this.armyPower(share);
		if (send <= 0) return { ok: false, lines: ["You have no vampires to send."] };
		const result = resolveBattle(send, Math.max(1, h.garrison), this.random);
		const lost = this.loseUnits(share, result.attackerLoss);
		const lines = [`Your army (power ${Math.round(send).toLocaleString("en-US")}) attacked the raiders holding your building.`];
		if (result.attackerWins) {
			this.restore(id);
			lines.push("Victory! The building is yours again.");
		} else {
			h.garrison = Math.max(1, h.garrison * (1 - result.defenderLoss));
			lines.push("Defeat. The raiders held on.");
		}
		lines.push(lost > 0 ? `You lost ${lost.toLocaleString("en-US")} units.` : "You lost no units.");
		return { ok: true, won: result.attackerWins, lines };
	}

	// ---------- what the windows show ----------
	outpostInfo(id) {
		const o = this.outposts.find((x) => x.id === id);
		if (!o) return null;
		const f = FACTIONS[o.faction];
		return { id, name: f.name, what: f.what, strength: o.strength, text: describeStrength(o.strength * 1.25, this.towers() > 0), raids: o.raids, raiding: !!(this.raid && this.raid.outpost === id) };
	}

	heldInfo(id) {
		const h = this.held[id];
		if (!h) return null;
		return { id, name: this.town.Buildings[{ 1: "Hut", 4: "Mine", 5: "Farm", 7: "LumberMill", 8: "BloodTemple", 10: "WatchTower", 11: "GuardOutpost", 12: "Fort" }[h.type]]?.name || "building", garrison: h.garrison, text: describeStrength(h.garrison, this.towers() > 0) };
	}

	defenceInfo(id) {
		const type = this.town.tiles[id];
		const key = this.town.buildingKey(id);
		if (!key || !GARRISON[type]) return null;
		const level = this.levelNow();
		return {
			id, type, key, name: this.town.Buildings[key].name,
			garrison: this.garrisonOf(id), full: baseStrength(level) * GARRISON[type],
			damage: this.damage[id] || 0, radius: type === TILE.FORT ? FORT_RADIUS : 0,
			towers: this.towers(), guards: this.guards(),
		};
	}

	// A line over the map when a raid is on its way and a watch tower has seen it
	banner() {
		const r = this.raid;
		if (!r || !r.warned) return null;
		const o = this.outposts.find((x) => x.id === r.outpost);
		if (!o) return null;
		const left = Math.max(0, r.left) * 10;
		return `Raiders from ${FACTIONS[o.faction].name} are marching on your ${this.nameOf(r.target)}: strength ${describeStrength(r.strength, true)}, arriving in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}. Your army: ${Math.round(this.armyPower()).toLocaleString("en-US")}.`;
	}
}
