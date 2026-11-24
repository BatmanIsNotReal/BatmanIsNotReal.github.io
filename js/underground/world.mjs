// One underground level: players, monsters, shots, walls. No drawing and no networking in here, so the
// server runs it for everyone and the browser can run it alone for testing (?solo).
import {
	ARENA, PLAYER_RADIUS, PLAYER_SPEED, CLAW, FIRE, RESPAWN_SECONDS, SHIELD_SECONDS, HELMET_CHANCE,
	dungeonById, monstersOf, maxHealth, damageTaken, clawDamage, fireDamage,
} from "../rules.mjs";

export const TICK_RATE = 20;

function seeded(seed) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

// Moves something by (dx, dy), keeping it inside the arena and sliding around the walls. Shared with the
// browser, which uses it to move your own character at once instead of waiting for the server.
export function slide(obstacles, e, dx, dy, r) {
	e.x = Math.max(r, Math.min(ARENA.width - r, e.x + dx));
	e.y = Math.max(r, Math.min(ARENA.height - r, e.y + dy));
	for (const o of obstacles) {
		const d = dist(e.x, e.y, o.x, o.y);
		const min = o.r + r;
		if (d < min) {
			const k = d === 0 ? 0 : (min - d) / d;
			e.x += (e.x - o.x) * k + (d === 0 ? min : 0);
			e.y += (e.y - o.y) * k;
		}
	}
}

// What the player's keys do in `dt` seconds
export function walk(obstacles, e, mx, my, dt) {
	const len = Math.hypot(mx, my);
	if (len > 1) { mx /= len; my /= len; }
	slide(obstacles, e, mx * PLAYER_SPEED * dt, my * PLAYER_SPEED * dt, PLAYER_RADIUS);
}

// The walls of a level are the same every time (seeded by the level number), so the browser can draw
// them without the server sending them.
export function obstaclesFor(dungeonId) {
	const rng = seeded(1000 + dungeonId * 77);
	const out = [];
	const keepClear = [[220, ARENA.height / 2, 260], [ARENA.width / 2, ARENA.height / 2, dungeonId === 6 ? 180 : 0]];
	let guard = 0;
	while (out.length < (dungeonId === 6 ? 26 : 34) && guard++ < 1000) {
		const r = 28 + rng() * 46;
		const x = 90 + rng() * (ARENA.width - 180);
		const y = 90 + rng() * (ARENA.height - 180);
		if (keepClear.some(([cx, cy, cr]) => cr && dist(x, y, cx, cy) < cr + r)) continue;
		if (out.some((o) => dist(x, y, o.x, o.y) < o.r + r + 70)) continue;
		out.push({ x: Math.round(x), y: Math.round(y), r: Math.round(r) });
	}
	return out;
}

export class World {
	// hooks: { onKill(playerId, monster, reward), onHelmet(playerId, dungeonId), onDeath(playerId, byName), onPlayerKill(killerId, victimId) }
	constructor(dungeonId, hooks = {}, options = {}) {
		this.dungeon = dungeonById(dungeonId);
		if (!this.dungeon) throw new Error("unknown dungeon " + dungeonId);
		this.hooks = hooks;
		this.rng = options.rng || Math.random;
		this.helmetChance = options.helmetChance ?? HELMET_CHANCE;
		this.obstacles = obstaclesFor(this.dungeon.id);
		this.kinds = monstersOf(this.dungeon.id);
		this.players = new Map();
		this.monsters = [];
		this.shots = [];
		this.fx = [];
		this.nextId = 1;
		this.time = 0;
		this.spawnTimer = 0;
	}

	get pvp() { return !!this.dungeon.pvp; }

	spawnPoint() {
		if (this.pvp) {
			for (let tries = 0; tries < 40; tries++) {
				const x = 120 + this.rng() * (ARENA.width - 240);
				const y = 120 + this.rng() * (ARENA.height - 240);
				const others = [...this.players.values()].filter((p) => !p.dead);
				if (this.blocked(x, y, PLAYER_RADIUS)) continue;
				if (others.some((p) => dist(p.x, p.y, x, y) < 400)) continue;
				return { x, y };
			}
		}
		return { x: 130 + this.rng() * 70, y: ARENA.height / 2 + (this.rng() - 0.5) * 160 };
	}

	blocked(x, y, r) {
		return this.obstacles.some((o) => dist(x, y, o.x, o.y) < o.r + r);
	}

	addPlayer(id, info) {
		const stats = info.stats || { health: 1, defence: 1, strength: 1, magic: 1 };
		const at = this.spawnPoint();
		const p = {
			id, name: info.name || "Vampire", level: info.level || 1, stats,
			x: at.x, y: at.y, hp: maxHealth(stats.health), maxHp: maxHealth(stats.health),
			mx: 0, my: 0, aim: 0, face: 1, claw: false, fire: false, clawCd: 0, fireCd: 0,
			dead: false, respawn: 0, shield: SHIELD_SECONDS, kills: 0, seq: 0,
		};
		this.players.set(id, p);
		return p;
	}

	removePlayer(id) {
		this.players.delete(id);
		for (const m of this.monsters) if (m.target === id) m.target = null;
		this.shots = this.shots.filter((s) => s.owner !== id);
	}

	input(id, data) {
		const p = this.players.get(id);
		if (!p || !data) return;
		const num = (v, lo, hi, d = 0) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
		p.mx = num(data.mx, -1, 1);
		p.my = num(data.my, -1, 1);
		p.aim = num(data.aim, -7, 7);
		p.claw = !!data.claw;
		p.fire = !!data.fire;
		if (Number.isInteger(data.seq)) p.seq = data.seq;
	}

	// ---- one step of the simulation ----
	step(dt) {
		this.time += dt;
		for (const p of this.players.values()) this.stepPlayer(p, dt);
		if (!this.pvp) {
			this.spawnMonsters(dt);
			for (const m of this.monsters) this.stepMonster(m, dt);
		}
		this.stepShots(dt);
	}

	stepPlayer(p, dt) {
		p.clawCd = Math.max(0, p.clawCd - dt);
		p.fireCd = Math.max(0, p.fireCd - dt);
		p.shield = Math.max(0, p.shield - dt);
		if (p.dead) {
			p.respawn -= dt;
			if (p.respawn <= 0) {
				const at = this.spawnPoint();
				Object.assign(p, { x: at.x, y: at.y, hp: p.maxHp, dead: false, shield: SHIELD_SECONDS });
			}
			return;
		}
		let { mx, my } = p;
		const len = Math.hypot(mx, my);
		if (len > 1) { mx /= len; my /= len; }
		if (mx !== 0) p.face = mx < 0 ? -1 : 1;
		walk(this.obstacles, p, mx, my, dt);

		if (p.claw && p.clawCd <= 0) this.doClaw(p);
		if (p.fire && p.fireCd <= 0) this.doFire(p);
	}

	// Moves with sliding along walls
	move(e, dx, dy, r) {
		slide(this.obstacles, e, dx, dy, r);
	}

	doClaw(p) {
		p.clawCd = CLAW.cooldown;
		const damage = clawDamage(p.stats.strength);
		this.fx.push({ k: "claw", x: p.x, y: p.y, a: p.aim, p: p.id });
		const inCone = (tx, ty, tr) => {
			const d = dist(p.x, p.y, tx, ty);
			if (d > CLAW.range + tr + PLAYER_RADIUS * 0.5) return false;
			if (d < 1) return true;
			let diff = Math.atan2(ty - p.y, tx - p.x) - p.aim;
			diff = Math.atan2(Math.sin(diff), Math.cos(diff));
			return Math.abs(diff) <= CLAW.arc / 2 || d < tr + 8;
		};
		for (const m of [...this.monsters]) if (!m.dead && inCone(m.x, m.y, m.radius)) this.hitMonster(m, damage, p);
		if (this.pvp) {
			for (const o of this.players.values()) {
				if (o === p || o.dead || o.shield > 0) continue;
				if (inCone(o.x, o.y, PLAYER_RADIUS)) this.hitPlayer(o, damage, p);
			}
		}
	}

	doFire(p) {
		p.fireCd = FIRE.cooldown;
		const vx = Math.cos(p.aim), vy = Math.sin(p.aim);
		this.shots.push({
			id: this.nextId++, owner: p.id, x: p.x + vx * (PLAYER_RADIUS + 4), y: p.y + vy * (PLAYER_RADIUS + 4),
			vx: vx * FIRE.speed, vy: vy * FIRE.speed, life: FIRE.life, damage: fireDamage(p.stats.magic),
		});
		this.fx.push({ k: "cast", x: p.x, y: p.y, a: p.aim, p: p.id });
	}

	stepShots(dt) {
		for (const s of this.shots) {
			s.life -= dt;
			s.x += s.vx * dt;
			s.y += s.vy * dt;
			if (s.x < 0 || s.y < 0 || s.x > ARENA.width || s.y > ARENA.height || this.blocked(s.x, s.y, FIRE.radius * 0.5)) {
				s.life = 0;
				this.fx.push({ k: "puff", x: s.x, y: s.y });
				continue;
			}
			const owner = this.players.get(s.owner);
			for (const m of this.monsters) {
				if (m.dead || dist(s.x, s.y, m.x, m.y) > m.radius + FIRE.radius) continue;
				this.hitMonster(m, s.damage, owner, true);
				s.life = 0;
				break;
			}
			if (s.life > 0 && this.pvp) {
				for (const o of this.players.values()) {
					if (o.id === s.owner || o.dead || o.shield > 0) continue;
					if (dist(s.x, s.y, o.x, o.y) > PLAYER_RADIUS + FIRE.radius) continue;
					this.hitPlayer(o, s.damage, owner, true);
					s.life = 0;
					break;
				}
			}
		}
		this.shots = this.shots.filter((s) => s.life > 0);
		this.monsters = this.monsters.filter((m) => !m.dead);
	}

	hitMonster(m, damage, by, magic = false) {
		const amount = Math.round(damage);
		m.hp -= amount;
		m.hurt = 0.15;
		if (by) m.target = by.id;
		this.fx.push({ k: "hit", x: m.x, y: m.y - m.radius, n: amount, m: magic ? 1 : 0 });
		if (m.hp > 0) return;
		m.dead = true;
		this.fx.push({ k: "boom", x: m.x, y: m.y, c: m.color });
		if (!by) return;
		by.kills++;
		this.hooks.onKill?.(by.id, m, m.reward);
		if (this.rng() < this.helmetChance) this.hooks.onHelmet?.(by.id, this.dungeon.id);
	}

	hitPlayer(p, rawDamage, by, magic = false) {
		if (p.dead || p.shield > 0) return;
		const amount = damageTaken(rawDamage, p.stats.defence);
		p.hp -= amount;
		this.fx.push({ k: "hit", x: p.x, y: p.y - PLAYER_RADIUS, n: amount, m: magic ? 1 : 0, me: p.id });
		if (p.hp > 0) return;
		p.hp = 0;
		p.dead = true;
		p.respawn = RESPAWN_SECONDS;
		p.claw = p.fire = false;
		this.fx.push({ k: "boom", x: p.x, y: p.y, c: "#a01028" });
		const killerName = by ? by.name : "the dark";
		this.hooks.onDeath?.(p.id, killerName);
		if (by && by !== p && this.pvp) {
			by.kills++;
			this.hooks.onPlayerKill?.(by.id, p.id, p.level);
		}
	}

	// ---- monsters ----
	maxMonsters() {
		return Math.min(34, 7 + this.players.size * 4);
	}

	spawnMonsters(dt) {
		if (this.players.size === 0) return;
		this.spawnTimer -= dt;
		if (this.spawnTimer > 0 || this.monsters.length >= this.maxMonsters()) return;
		this.spawnTimer = this.monsters.length < 4 ? 0.1 : 0.9;
		const alive = [...this.players.values()].filter((p) => !p.dead);
		for (let tries = 0; tries < 25; tries++) {
			const x = 80 + this.rng() * (ARENA.width - 160);
			const y = 80 + this.rng() * (ARENA.height - 160);
			if (this.blocked(x, y, 30)) continue;
			if (alive.some((p) => dist(p.x, p.y, x, y) < 450)) continue;
			const kind = this.kinds[Math.floor(this.rng() * this.kinds.length)];
			this.monsters.push({
				id: this.nextId++, type: this.kinds.indexOf(kind), name: kind.name, color: kind.color, x, y,
				hp: kind.hp, maxHp: kind.hp, damage: kind.damage, speed: kind.speed * (0.9 + this.rng() * 0.2), radius: kind.radius,
				reward: kind.reward, state: 0, timer: 0, cooldown: 0, target: null, hurt: 0,
				wander: this.rng() * 6.28, wanderT: 0, face: 1,
			});
			return;
		}
	}

	stepMonster(m, dt) {
		m.hurt = Math.max(0, m.hurt - dt);
		m.cooldown = Math.max(0, m.cooldown - dt);
		// Choose who to chase: the nearest living player in sight (or the one who hurt it)
		let best = null, bestD = 750;
		for (const p of this.players.values()) {
			if (p.dead) continue;
			const d = dist(p.x, p.y, m.x, m.y);
			if (d < bestD) { best = p; bestD = d; }
		}
		const target = best;
		if (m.state === 1) { // winding up: stands still, then strikes once if the target is still close
			m.timer -= dt;
			if (m.timer <= 0) {
				m.state = 2;
				m.timer = 0.35;
				if (target && !target.dead && dist(target.x, target.y, m.x, m.y) <= m.radius + PLAYER_RADIUS + 18) {
					this.fx.push({ k: "bite", x: m.x, y: m.y, tx: target.x, ty: target.y });
					this.hitPlayer(target, m.damage, { name: m.name });
				}
			}
			return;
		}
		if (m.state === 2) { // recovering
			m.timer -= dt;
			if (m.timer <= 0) { m.state = 0; m.cooldown = 0.7; }
			return;
		}
		if (target) {
			const dx = target.x - m.x, dy = target.y - m.y;
			const d = Math.hypot(dx, dy) || 1;
			if (dx !== 0) m.face = dx < 0 ? -1 : 1;
			const reach = m.radius + PLAYER_RADIUS + 8;
			if (d <= reach) {
				if (m.cooldown <= 0) { m.state = 1; m.timer = 0.45; }
			} else {
				this.move(m, (dx / d) * m.speed * dt, (dy / d) * m.speed * dt, m.radius);
			}
		} else {
			m.wanderT -= dt;
			if (m.wanderT <= 0) { m.wander = this.rng() * 6.28; m.wanderT = 1 + this.rng() * 2; }
			this.move(m, Math.cos(m.wander) * m.speed * 0.3 * dt, Math.sin(m.wander) * m.speed * 0.3 * dt, m.radius);
		}
		// Do not stack on each other
		for (const o of this.monsters) {
			if (o === m || o.dead) continue;
			const d = dist(m.x, m.y, o.x, o.y);
			const min = (m.radius + o.radius) * 0.9;
			if (d < min && d > 0) {
				const push = (min - d) / 2 / d;
				m.x += (m.x - o.x) * push; m.y += (m.y - o.y) * push;
			}
		}
	}

	// What goes to the players (short keys, rounded: it is sent 20 times a second)
	snapshot() {
		const r = (v) => Math.round(v);
		const snap = {
			t: "s",
			p: [...this.players.values()].map((p) => [p.id, r(p.x), r(p.y), r(p.hp), p.maxHp, p.face, Math.round(p.aim * 100) / 100, (p.dead ? 1 : 0) | (p.shield > 0 ? 2 : 0), p.kills, p.seq]),
			m: this.monsters.map((m) => [m.id, m.type, r(m.x), r(m.y), r(m.hp), m.maxHp, m.state, m.face, m.hurt > 0 ? 1 : 0]),
			b: this.shots.map((s) => [s.id, r(s.x), r(s.y)]),
			f: this.fx,
		};
		this.fx = [];
		return snap;
	}
}
