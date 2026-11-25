// The underground, as the player sees it: a full-screen overlay with the fight, the controls and the HUD.
// The fight itself is calculated by the server (server.js runs js/underground/world.mjs for everybody);
// this file connects to it, sends what the player does and draws what comes back.
// With ?solo in the address the same World runs in the browser instead, for trying things out alone.
import { ARENA, PLAYER_RADIUS, CLAW, dungeonById, monstersOf } from "../rules.mjs";
import { World, TICK_RATE, obstaclesFor, walk } from "./world.mjs";
import { drawAvatar, defaultAvatar, normalizeAvatar } from "../profile/Avatar.js";
import { monsterSprite } from "./sprites.js";

// Other things are drawn this long ago, between two snapshots, so that they move smoothly
// even when the network delivers them unevenly. Your own character is not delayed (see predicted movement).
const INTERP_MS = 100;

// One look per dungeon: dark sand, lava, burned wood and black stone, in different colours.
const THEMES = {
	1: { sand: ["#3a2f27", "#41352b", "#483a2f"], dark: "#1a120d", lava: ["#d9481a", "#f07a22", "#ffc24a"], crust: "#3a1409", wood: ["#17110e", "#2a1f19"], rock: ["#2b2624", "#3d3633"], ember: "#ff7a2a", glow: "#c4561c" },
	2: { sand: ["#34322d", "#3b3933", "#423f38"], dark: "#15130f", lava: ["#c9421a", "#e87020", "#ffb844"], crust: "#2e1409", wood: ["#14110f", "#26211d"], rock: ["#2a2827", "#3c3a38"], ember: "#ff7a2a", glow: "#a8501c" },
	3: { sand: ["#3c2c29", "#43312d", "#4b3732"], dark: "#1c110f", lava: ["#c2281c", "#e8501e", "#ff9a40"], crust: "#3a0e0a", wood: ["#190f0d", "#2d1b17"], rock: ["#2d2222", "#3f302e"], ember: "#ff5a2a", glow: "#b8321c" },
	4: { sand: ["#382a22", "#3f2f28", "#46352e"], dark: "#170f0a", lava: ["#e84a12", "#ff8a1c", "#ffe066"], crust: "#3c1306", wood: ["#150e0b", "#281b15"], rock: ["#251f1c", "#38302c"], ember: "#ffa030", glow: "#e0661c" },
	5: { sand: ["#302a32", "#372f3a", "#3e3542"], dark: "#120e15", lava: ["#8a2ad0", "#b04af0", "#e49cff"], crust: "#220f33", wood: ["#120e14", "#241c28"], rock: ["#221e28", "#342d3b"], ember: "#c870ff", glow: "#8a3ad0" },
	6: { sand: ["#382525", "#3f2929", "#462e2e"], dark: "#170c0c", lava: ["#b01026", "#dc2038", "#ff6a6a"], crust: "#340a10", wood: ["#150b0b", "#281515"], rock: ["#2a1d1d", "#3c2a2a"], ember: "#ff4a4a", glow: "#c41e35" },
};


// ---------- Connections: the same small interface for the server and for solo play ----------
class RemoteConnection {
	constructor(url, join, handlers) {
		this.handlers = handlers;
		this.ws = new WebSocket(url);
		this.ws.onopen = () => this.ws.send(JSON.stringify({ t: "join", ...join }));
		this.ws.onmessage = (event) => {
			try { handlers.message(JSON.parse(event.data)); } catch { /* ignore a broken message */ }
		};
		this.ws.onclose = () => handlers.close();
		this.ws.onerror = () => {};
	}
	send(message) {
		if (this.ws.readyState === 1) this.ws.send(JSON.stringify(message));
	}
	close() {
		try { this.send({ t: "leave" }); this.ws.close(); } catch { /* already closed */ }
	}
}

class LocalConnection {
	constructor(join, handlers, info) {
		this.handlers = handlers;
		const pid = "1";
		const say = (message) => setTimeout(() => handlers.message(message), 0);
		const dungeon = dungeonById(join.dungeon);
		this.world = new World(join.dungeon, {
			onKill: (id, monster, reward) => say({ t: "reward", ...reward, name: monster.name }),
			onHelmet: (id, d) => say({ t: "helmet", dungeon: d, name: "helmet", isNew: true, owned: [d] }),
			onDeath: (id, by) => say({ t: "died", by }),
		}, { helmetChance: info.helmetChance });
		this.world.addPlayer(pid, { name: info.name, level: info.level, stats: info.attributes });
		say({ t: "hello", you: pid, dungeon: dungeon.id, name: dungeon.name, pvp: !!dungeon.pvp });
		say({ t: "roster", players: { [pid]: { name: info.name, avatar: info.avatar, helmet: info.helmet, level: info.level } } });
		this.timer = setInterval(() => {
			this.world.step(1 / TICK_RATE);
			handlers.message(this.world.snapshot());
		}, 1000 / TICK_RATE);
		this.pid = pid;
	}
	send(message) {
		if (message.t === "in") this.world.input(this.pid, message);
		else if (message.t === "leave") this.close();
	}
	close() {
		clearInterval(this.timer);
	}
}

// ---------- The overlay ----------
export default class Underground {
	// options: {
	//   url, solo, getPlayer() -> { id, name, level, avatar, helmet, attributes },
	//   prepare() -> promise (e.g. make sure the server knows the latest level),
	//   onReward(reward) -> text for the feed, onDied(by) -> text, onHelmet(message), onOpen(), onClose()
	// }
	constructor(document, options) {
		this.document = document;
		this.options = options;
		this.active = false;
		this.overlay = null;
	}

	build() {
		const d = this.document;
		const overlay = d.createElement("div");
		overlay.id = "undergroundOverlay";
		overlay.className = "ug-overlay";
		overlay.innerHTML = `
			<canvas class="ug-canvas"></canvas>
			<div class="ug-top"><span class="ug-title"></span><span class="ug-count"></span></div>
			<button type="button" class="button ug-leave">Leave (Esc)</button>
			<div class="ug-feed" aria-live="polite"></div>
			<div class="ug-bottom">
				<div class="ug-hp"><div class="ug-hp-fill"></div><span class="ug-hp-text"></span></div>
				<div class="ug-help">WASD move &middot; left click: claw &middot; right click: fire</div>
			</div>
			<div class="ug-message" hidden></div>`;
		d.body.appendChild(overlay);
		this.overlay = overlay;
		this.canvas = overlay.querySelector(".ug-canvas");
		this.ctx = this.canvas.getContext("2d");
		this.ui = {
			title: overlay.querySelector(".ug-title"), count: overlay.querySelector(".ug-count"),
			feed: overlay.querySelector(".ug-feed"), hpFill: overlay.querySelector(".ug-hp-fill"),
			hpText: overlay.querySelector(".ug-hp-text"), message: overlay.querySelector(".ug-message"),
		};
		overlay.querySelector(".ug-leave").addEventListener("click", () => this.close());
		this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
		this.canvas.addEventListener("mousedown", (e) => {
			if (e.button === 0) this.input.claw = true;
			if (e.button === 2) this.input.fire = true;
			this.moveMouse(e);
			e.preventDefault();
		});
		window.addEventListener("mouseup", (e) => {
			if (e.button === 0) this.input.claw = false;
			if (e.button === 2) this.input.fire = false;
		});
		this.canvas.addEventListener("mousemove", (e) => this.moveMouse(e));
		window.addEventListener("keydown", (e) => this.key(e, true));
		window.addEventListener("keyup", (e) => this.key(e, false));
		window.addEventListener("blur", () => this.resetInput());
	}

	resetInput() {
		this.keys = {};
		this.input = { claw: false, fire: false };
	}

	moveMouse(e) {
		const rect = this.canvas.getBoundingClientRect();
		this.mouse = { x: (e.clientX - rect.left) * (this.canvas.width / rect.width), y: (e.clientY - rect.top) * (this.canvas.height / rect.height) };
	}

	key(e, down) {
		if (!this.active) return;
		const map = { w: "up", arrowup: "up", s: "down", arrowdown: "down", a: "left", arrowleft: "left", d: "right", arrowright: "right" };
		const name = map[e.key.toLowerCase()];
		if (name) { this.keys[name] = down; e.preventDefault(); }
		if (down && e.key === "Escape") this.close();
	}

	// ---- open / close ----
	async open(dungeonId) {
		if (this.active) return;
		if (!this.overlay) this.build();
		this.active = true;
		this.dungeonId = dungeonId;
		this.resetInput();
		this.mouse = { x: 0, y: 0 };
		this.snap = null; this.buf = []; this.pending = []; this.seq = 0; this.pred = null; this.fix = null; this.lastFrame = 0; this.myFace = 1; this.cam = { x: 0, y: 0 };
		this.roster = {}; this.avatars = new Map(); this.fx = []; this.feed = [];
		this.me = null; this.dead = false;
		this.obstacles = obstaclesFor(dungeonId);
		this.theme = THEMES[dungeonId] || THEMES[1];
		this.lastDraw = 0;
		this.buildBackground();
		const dungeon = dungeonById(dungeonId);
		this.kinds = monstersOf(dungeonId);
		this.ui.title.textContent = dungeon.name;
		this.ui.count.textContent = "";
		this.ui.feed.innerHTML = "";
		this.say("Entering the underground...");
		this.overlay.classList.add("open");
		this.document.body.classList.add("ug-active");
		this.options.onOpen?.();
		this.resize();
		this.onResize = () => this.resize();
		window.addEventListener("resize", this.onResize);

		try { await this.options.prepare?.(); } catch { /* the join will say what is wrong */ }
		if (!this.active) return;
		const player = this.options.getPlayer();
		const join = { id: player.id, dungeon: dungeonId };
		const handlers = { message: (m) => this.receive(m), close: () => this.lost() };
		try {
			this.conn = this.options.solo
				? new LocalConnection(join, handlers, { ...player, helmetChance: this.options.helmetChance })
				: new RemoteConnection(this.options.url, join, handlers);
		} catch {
			this.say("The underground cannot be reached right now.", true);
			return;
		}
		this.sender = setInterval(() => this.sendInput(), 50);
		this.frame = requestAnimationFrame((t) => this.draw(t));
	}

	close(message) {
		if (!this.active) return;
		this.active = false;
		clearInterval(this.sender);
		cancelAnimationFrame(this.frame);
		window.removeEventListener("resize", this.onResize);
		try { this.conn?.close(); } catch { /* already gone */ }
		this.conn = null;
		this.overlay.classList.remove("open");
		this.document.body.classList.remove("ug-active");
		this.options.onClose?.(message);
	}

	say(text, stuck = false) {
		this.ui.message.hidden = !text;
		this.ui.message.textContent = text || "";
		this.ui.message.classList.toggle("stuck", stuck);
	}

	lost() {
		if (!this.active) return;
		if (!this.me) { this.say("The underground cannot be reached right now. Press Esc to leave.", true); return; }
		this.say("The connection to the underground was lost. Press Esc to leave.", true);
		clearInterval(this.sender);
	}

	// Big screens are drawn smaller and stretched (pixel art does not mind): far fewer pixels to paint
	resize() {
		const width = this.overlay.clientWidth || window.innerWidth;
		const height = this.overlay.clientHeight || window.innerHeight;
		const k = Math.max(1, width / 1280, height / 720);
		this.canvas.width = Math.round(width / k);
		this.canvas.height = Math.round(height / k);
		this.ctx.imageSmoothingEnabled = false;
	}

	// ---- messages from the server ----
	receive(m) {
		if (!this.active || !m) return;
		if (m.t === "hello") { this.me = m.you; this.pvp = !!m.pvp; this.say(""); }
		else if (m.t === "roster") { this.roster = m.players || {}; this.ui.count.textContent = Object.keys(this.roster).length + " here"; }
		else if (m.t === "s") this.snapshot(m);
		else if (m.t === "reward") {
			const text = this.options.onReward?.(m);
			if (text) this.addFeed(text);
		} else if (m.t === "helmet") {
			const text = this.options.onHelmet?.(m);
			this.addFeed(text || `You found a helmet!`, true);
		} else if (m.t === "died") {
			const text = this.options.onDied?.(m.by);
			this.addFeed(text || "You died.", false, true);
		} else if (m.t === "error") {
			this.say(m.error || "Something went wrong.", true);
			this.errored = true;
		}
	}

	snapshot(m) {
		const now = performance.now();
		const players = new Map(m.p.map((a) => [a[0], { id: a[0], x: a[1], y: a[2], hp: a[3], maxHp: a[4], face: a[5], aim: a[6], dead: !!(a[7] & 1), shield: !!(a[7] & 2), kills: a[8], seq: a[9] }]));
		const monsters = new Map(m.m.map((a) => [a[0], { id: a[0], type: a[1], x: a[2], y: a[3], hp: a[4], maxHp: a[5], state: a[6], face: a[7], hurt: a[8] }]));
		this.snap = { time: now, players, monsters, shots: m.b.map((a) => ({ id: a[0], x: a[1], y: a[2] })) };
		this.buf.push(this.snap);
		if (this.buf.length > 12) this.buf.shift();
		for (const fx of m.f) {
			// effects wait for the delayed picture, so a hit shows up when you see the monster get hit
			const entry = { ...fx, t0: now + INTERP_MS };
			if (fx.k === "boom") entry.parts = Array.from({ length: 10 }, () => ({ a: Math.random() * 6.28, s: 40 + Math.random() * 90 }));
			this.fx.push(entry);
		}
		const mine = players.get(this.me);
		if (mine) {
			this.dead = mine.dead;
			// Predicted movement: the server's position is a little old. Take it, replay the moves it has
			// not processed yet, and pull the character we show gently towards that.
			this.pending = this.pending.filter((input) => input.seq > mine.seq);
			const target = { x: mine.x, y: mine.y };
			if (!mine.dead) for (const input of this.pending) walk(this.obstacles, target, input.mx, input.my, 1 / TICK_RATE);
			const error = this.pred ? Math.hypot(target.x - this.pred.x, target.y - this.pred.y) : Infinity;
			if (!this.pred || mine.dead || error > 120) { this.pred = target; this.fix = { x: 0, y: 0 }; }
			else this.fix = { x: target.x - this.pred.x, y: target.y - this.pred.y }; // eased in by advance(), never jumped
			const pct = Math.max(0, Math.min(1, mine.hp / mine.maxHp));
			this.ui.hpFill.style.width = pct * 100 + "%";
			this.ui.hpText.textContent = `${mine.hp} / ${mine.maxHp}`;
			if (mine.dead) this.say("You died. You will rise again at the entrance...");
			else if (!this.errored) this.say("");
		}
	}

	addFeed(text, special = false, bad = false) {
		const line = this.document.createElement("div");
		line.className = "ug-line" + (special ? " special" : "") + (bad ? " bad" : "");
		line.textContent = text;
		this.ui.feed.appendChild(line);
		while (this.ui.feed.children.length > 6) this.ui.feed.firstChild.remove();
		setTimeout(() => line.remove(), special ? 9000 : 5000);
	}

	// ---- what the player does ----
	sendInput() {
		if (!this.conn || !this.snap) return;
		const k = this.keys;
		const mx = (k.right ? 1 : 0) - (k.left ? 1 : 0);
		const my = (k.down ? 1 : 0) - (k.up ? 1 : 0);
		let aim = 0;
		if (this.pred) aim = Math.atan2(this.mouse.y - (this.pred.y - this.cam.y), this.mouse.x - (this.pred.x - this.cam.x));
		const seq = ++this.seq;
		this.pending.push({ seq, mx, my });
		if (this.pending.length > 40) this.pending.shift();
		this.conn.send({ t: "in", seq, mx, my, aim: Math.round(aim * 100) / 100, claw: this.input.claw, fire: this.input.fire });
	}

	// ---- drawing ----
	// Your own character moves at once with your keys (the same rules as the server's); this runs every frame
	advance(now) {
		const dt = Math.min(0.05, Math.max(0, (now - (this.lastFrame || now)) / 1000));
		this.lastFrame = now;
		if (!this.pred || this.dead) return;
		const k = this.keys;
		const mx = (k.right ? 1 : 0) - (k.left ? 1 : 0);
		const my = (k.down ? 1 : 0) - (k.up ? 1 : 0);
		if (mx) this.myFace = mx < 0 ? -1 : 1;
		walk(this.obstacles, this.pred, mx, my, dt);
		// The server's view differs from ours by a few pixels that change from update to update. Close the
		// gap slowly (and not at all when it is tiny), so the character glides instead of twitching.
		if (this.fix && Math.hypot(this.fix.x, this.fix.y) > 3) {
			const part = 1 - Math.exp(-3 * dt);
			this.pred.x += this.fix.x * part; this.pred.y += this.fix.y * part;
			this.fix.x -= this.fix.x * part; this.fix.y -= this.fix.y * part;
		}
	}

	// Everything else, as it was INTERP_MS ago, blended between the two snapshots around that moment
	view(now) {
		const buf = this.buf;
		if (!buf.length) return null;
		const rt = now - INTERP_MS;
		let a = buf[0], b = buf[0];
		for (let i = buf.length - 1; i >= 0; i--) {
			if (buf[i].time <= rt) { a = buf[i]; b = buf[i + 1] || buf[i]; break; }
		}
		const t = a === b ? 1 : Math.max(0, Math.min(1, (rt - a.time) / (b.time - a.time)));
		const mix = (from, to) => (from ? { ...to, x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t } : to);
		const players = new Map();
		for (const [id, p] of b.players) players.set(id, mix(a.players.get(id), p));
		const mine = players.get(this.me);
		const latest = this.snap.players.get(this.me);
		if (mine && latest && this.pred) players.set(this.me, { ...latest, x: this.pred.x, y: this.pred.y, face: this.myFace });
		const monsters = [...b.monsters.values()].map((m) => mix(a.monsters.get(m.id), m));
		const shotsBefore = new Map(a.shots.map((x) => [x.id, x]));
		const shots = b.shots.map((x) => mix(shotsBefore.get(x.id), x));
		return { players, monsters, shots };
	}

	avatarFor(id) {
		const info = this.roster[id] || {};
		const avatar = normalizeAvatar(info.avatar || defaultAvatar(info.name || id));
		const key = JSON.stringify(avatar) + ":" + (info.helmet || 0);
		let entry = this.avatars.get(id);
		if (!entry || entry.key !== key) {
			const canvas = this.document.createElement("canvas");
			drawAvatar(canvas, avatar, info.helmet || 0);
			entry = { key, canvas };
			this.avatars.set(id, entry);
		}
		return entry.canvas;
	}

	draw(now) {
		if (!this.active) return;
		this.frame = requestAnimationFrame((t) => this.draw(t));
		if (now - this.lastDraw < 14) return; // no more than about 60 pictures a second, even on a 144 Hz screen
		this.lastDraw = now;
		const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;
		ctx.imageSmoothingEnabled = false;
		ctx.fillStyle = "#050305";
		ctx.fillRect(0, 0, W, H);
		this.advance(now);
		const view = this.view(now);
		const me = view ? view.players.get(this.me) : null;
		const focus = me || { x: ARENA.width / 2, y: ARENA.height / 2 };
		this.cam = {
			x: ARENA.width <= W ? (ARENA.width - W) / 2 : Math.max(0, Math.min(ARENA.width - W, focus.x - W / 2)),
			y: ARENA.height <= H ? (ARENA.height - H) / 2 : Math.max(0, Math.min(ARENA.height - H, focus.y - H / 2)),
		};
		if (!view) return;
		this.v = view;
		ctx.save();
		ctx.translate(-Math.round(this.cam.x), -Math.round(this.cam.y));
		// The floor and walls never change: they are drawn once (buildBackground) and copied
		const sx = Math.max(0, Math.floor(this.cam.x)), sy = Math.max(0, Math.floor(this.cam.y));
		const sw = Math.min(ARENA.width - sx, Math.ceil(W + 1)), sh = Math.min(ARENA.height - sy, Math.ceil(H + 1));
		if (sw > 0 && sh > 0) {
			ctx.drawImage(this.bg, sx, sy, sw, sh, sx, sy, sw, sh);
			ctx.globalAlpha = 0.22 + 0.2 * Math.sin(now / 520); // the lava glows and fades
			ctx.drawImage(this.glow, sx, sy, sw, sh, sx, sy, sw, sh);
			ctx.globalAlpha = 1;
		}

		const things = [];
		for (const p of view.players.values()) things.push({ y: p.y, kind: "p", e: p });
		for (const m of view.monsters) things.push({ y: m.y, kind: "m", e: m });
		things.sort((a, b) => a.y - b.y);
		for (const t of things) (t.kind === "p" ? this.drawPlayer(ctx, t.e, now) : this.drawMonster(ctx, t.e, now));
		this.drawShots(ctx, now);
		this.drawFx(ctx, now);
		ctx.restore();
	}

	buildBackground() {
		this.bg = this.document.createElement("canvas");
		this.bg.width = ARENA.width;
		this.bg.height = ARENA.height;
		this.glow = this.document.createElement("canvas");
		this.glow.width = ARENA.width;
		this.glow.height = ARENA.height;
		this.paintLandscape(this.bg.getContext("2d"), this.glow.getContext("2d"));
	}

	// Draws the whole landscape once: dark sand, lava lakes, burned trees and black boulders. `glow` gets
	// the bright parts of the lava on their own, so they can pulse without drawing everything again.
	paintLandscape(ctx, glow) {
		const th = this.theme, C = 16; // size of one ground block in pixels
		const cols = Math.ceil(ARENA.width / C), rows = Math.ceil(ARENA.height / C);
		const hash = (x, y, k = 0) => { const h = Math.sin(x * 12.9898 + y * 78.233 + k * 37.719 + this.dungeonId * 5.1) * 43758.5453; return h - Math.floor(h); };

		// which blocks are lava (rough edges: the edge of each lake wobbles a little)
		const lava = new Uint8Array(cols * rows);
		for (const o of this.obstacles) {
			if (o.kind !== "lava") continue;
			for (let y = Math.max(0, Math.floor((o.y - o.r - 8) / C)); y <= Math.min(rows - 1, Math.floor((o.y + o.r + 8) / C)); y++) {
				for (let x = Math.max(0, Math.floor((o.x - o.r - 8) / C)); x <= Math.min(cols - 1, Math.floor((o.x + o.r + 8) / C)); x++) {
					const d = Math.hypot(x * C + C / 2 - o.x, y * C + C / 2 - o.y);
					if (d < o.r + (hash(x, y, 1) - 0.4) * 9) lava[y * cols + x] = 1;
				}
			}
		}
		const isLava = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows && lava[y * cols + x] === 1;
		const nearLava = (x, y) => { for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (isLava(x + i, y + j)) return Math.max(Math.abs(i), Math.abs(j)); return 0; };

		// ground
		ctx.fillStyle = th.dark;
		ctx.fillRect(0, 0, ARENA.width, ARENA.height);
		for (let y = 0; y < rows; y++) {
			for (let x = 0; x < cols; x++) {
				if (isLava(x, y)) continue;
				const v = hash(x, y);
				ctx.fillStyle = th.sand[v < 0.62 ? 0 : v < 0.92 ? 1 : 2];
				ctx.fillRect(x * C, y * C, C, C);
				const near = nearLava(x, y);
				if (near === 1) { ctx.fillStyle = "rgba(0,0,0,0.38)"; ctx.fillRect(x * C, y * C, C, C); }
				else if (near === 2) { ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.fillRect(x * C, y * C, C, C); }
				const w = hash(x, y, 2);
				if (w > 0.985) { ctx.fillStyle = th.dark; ctx.fillRect(x * C + 3, y * C + 6, 9, 3); ctx.fillRect(x * C + 9, y * C + 9, 3, 5); } // a crack
				else if (w < 0.014) { ctx.fillStyle = th.sand[2]; ctx.fillRect(x * C + 4, y * C + 5, 5, 4); ctx.fillStyle = th.dark; ctx.fillRect(x * C + 4, y * C + 9, 5, 2); } // a pebble
				else if (w > 0.93 && w < 0.94) { ctx.fillStyle = th.ember; ctx.globalAlpha = 0.55; ctx.fillRect(x * C + 6, y * C + 6, 3, 3); ctx.globalAlpha = 1; } // an ember
			}
		}

		// warm light on the sand around the lava
		for (const o of this.obstacles) {
			if (o.kind !== "lava") continue;
			const g = ctx.createRadialGradient(o.x, o.y, o.r * 0.7, o.x, o.y, o.r + 70);
			g.addColorStop(0, th.glow + "55"); g.addColorStop(1, th.glow + "00");
			ctx.fillStyle = g;
			ctx.fillRect(o.x - o.r - 70, o.y - o.r - 70, (o.r + 70) * 2, (o.r + 70) * 2);
		}

		// lava
		for (let y = 0; y < rows; y++) {
			for (let x = 0; x < cols; x++) {
				if (!isLava(x, y)) continue;
				const edge = !isLava(x - 1, y) || !isLava(x + 1, y) || !isLava(x, y - 1) || !isLava(x, y + 1);
				const v = hash(x, y, 3);
				ctx.fillStyle = th.lava[v < 0.55 ? 0 : 1]; ctx.fillRect(x * C, y * C, C, C);
				if (!edge) {
					if (v > 0.8) { ctx.fillStyle = th.lava[2]; ctx.fillRect(x * C + 3, y * C + 5, 8, 4); }
					else if (v < 0.12) { ctx.fillStyle = th.crust; ctx.fillRect(x * C + 4, y * C + 4, 8, 6); }
				} else {                                  // a dark crust along the open sides only
					ctx.fillStyle = th.crust;
					if (!isLava(x, y - 1)) ctx.fillRect(x * C, y * C, C, 5);
					if (!isLava(x, y + 1)) ctx.fillRect(x * C, y * C + C - 5, C, 5);
					if (!isLava(x - 1, y)) ctx.fillRect(x * C, y * C, 5, C);
					if (!isLava(x + 1, y)) ctx.fillRect(x * C + C - 5, y * C, 5, C);
				}
				if (!edge && v > 0.45 && v < 0.75) { glow.fillStyle = th.lava[2]; glow.fillRect(x * C + 2, y * C + 2, C - 4, C - 4); }
			}
		}

		// black boulders
		for (const o of this.obstacles) {
			if (o.kind !== "rock") continue;
			ctx.fillStyle = "rgba(0,0,0,0.4)";
			ctx.beginPath(); ctx.ellipse(o.x + 6, o.y + o.r * 0.7, o.r, o.r * 0.5, 0, 0, 6.3); ctx.fill();
			ctx.fillStyle = th.rock[0];
			ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 6.3); ctx.fill();
			ctx.fillStyle = th.rock[1];
			ctx.beginPath(); ctx.arc(o.x - o.r * 0.22, o.y - o.r * 0.25, o.r * 0.62, 0, 6.3); ctx.fill();
			ctx.fillStyle = th.dark;
			for (let i = 0; i < 3; i++) { const a = hash(o.x, o.y, 10 + i) * 6.3, d = o.r * (0.2 + hash(o.x, o.y, 20 + i) * 0.5); ctx.fillRect(Math.round(o.x + Math.cos(a) * d), Math.round(o.y + Math.sin(a) * d), 10, 4); }
			ctx.fillStyle = th.ember; ctx.globalAlpha = 0.6;
			ctx.fillRect(Math.round(o.x + o.r * 0.2), Math.round(o.y + o.r * 0.1), 4, 3);
			ctx.globalAlpha = 1;
			ctx.strokeStyle = "#0a0606"; ctx.lineWidth = 3;
			ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 6.3); ctx.stroke();
		}

		// burned trees, from the back of the map to the front
		for (const o of this.obstacles.filter((e) => e.kind === "tree").sort((a, b) => a.y - b.y)) this.paintTree(ctx, o, hash);

		// the edge of the cave and the way you came in (not in the Abyss)
		ctx.strokeStyle = th.glow;
		ctx.lineWidth = 6;
		ctx.strokeRect(0, 0, ARENA.width, ARENA.height);
		if (!this.pvp) {
			ctx.fillStyle = "rgba(255,255,255,0.06)";
			ctx.beginPath(); ctx.arc(160, ARENA.height / 2, 90, 0, 6.3); ctx.fill();
		}
	}

	paintTree(ctx, o, hash) {
		const th = this.theme, u = 5;                       // one "pixel" of the tree is 5x5
		const h = 11 + Math.floor(hash(o.x, o.y, 5) * 6);    // trunk height in pixels
		const base = o.y + o.r * 0.6, x = Math.round(o.x / u) * u, top = Math.round((base - h * u) / u) * u;
		const rect = (px, py, w, hh, color) => { ctx.fillStyle = color; ctx.fillRect(x + px * u, top + py * u, w * u, hh * u); };
		ctx.fillStyle = "rgba(0,0,0,0.4)";
		ctx.beginPath(); ctx.ellipse(o.x + 4, base, 16, 6, 0, 0, 6.3); ctx.fill();
		rect(-1, 0, 4, h, th.wood[0]);                       // trunk
		rect(0, 0, 1, h, th.wood[1]);                        // lighter strip on the trunk
		rect(-2, h - 2, 6, 2, th.wood[0]);                   // roots
		const lean = hash(o.x, o.y, 6) > 0.5 ? 1 : -1;
		const branches = 4 + Math.floor(hash(o.x, o.y, 7) * 3);
		for (let i = 0; i < branches; i++) {                 // bare, broken branches
			const by = 1 + Math.floor(hash(o.x, o.y, 30 + i) * (h - 4)), side = i % 2 ? lean : -lean, len = 3 + Math.floor(hash(o.x, o.y, 40 + i) * 4);
			for (let k = 1; k <= len; k++) rect(side > 0 ? 2 + k : -k, by - Math.floor(k / 2), 1, 2 - (k > 3 ? 1 : 0), th.wood[k % 2]);
		}
		rect(-1, -1, 4, 1, th.wood[0]);                      // snapped top
		if (hash(o.x, o.y, 8) > 0.45) { ctx.globalAlpha = 0.8; rect(0, 1 + Math.floor(hash(o.x, o.y, 9) * (h - 3)), 1, 1, th.ember); ctx.globalAlpha = 1; } // an ember still burning
	}

	drawBar(ctx, x, y, w, pct, color) {
		ctx.fillStyle = "#000"; ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
		ctx.fillStyle = "#3a1018"; ctx.fillRect(x - w / 2, y, w, 4);
		ctx.fillStyle = color; ctx.fillRect(x - w / 2, y, Math.max(0, w * pct), 4);
	}

	drawPlayer(ctx, p, now) {
		const info = this.roster[p.id] || {};
		const sprite = this.avatarFor(p.id);
		const S = 3, w = sprite.width * S, h = sprite.height * S;
		const mine = p.id === this.me;
		ctx.save();
		ctx.fillStyle = "rgba(0,0,0,0.4)";
		ctx.beginPath(); ctx.ellipse(p.x, p.y + 16, 18, 7, 0, 0, 6.3); ctx.fill();
		if (p.dead) ctx.globalAlpha = 0.3;
		ctx.translate(Math.round(p.x), 0);
		ctx.scale(p.face < 0 ? -1 : 1, 1);
		ctx.drawImage(sprite, -w / 2, Math.round(p.y + 18 - h), w, h);
		ctx.restore();
		if (p.shield && !p.dead) {
			ctx.strokeStyle = `rgba(230,200,120,${0.5 + 0.3 * Math.sin(now / 90)})`; ctx.lineWidth = 3;
			ctx.beginPath(); ctx.arc(p.x, p.y - 10, 30, 0, 6.3); ctx.stroke();
		}
		if (p.dead) return;
		this.drawBar(ctx, p.x, p.y - 58, 38, p.hp / p.maxHp, mine ? "#46c46a" : this.pvp ? "#e0283a" : "#46c46a");
		ctx.font = "bold 13px VT323, monospace";
		ctx.textAlign = "center";
		ctx.lineWidth = 3; ctx.strokeStyle = "#000";
		const name = info.name || "";
		ctx.strokeText(name, p.x, p.y - 62);
		ctx.fillStyle = mine ? "#ffd979" : this.pvp ? "#ff8a8a" : "#eadfce";
		ctx.fillText(name, p.x, p.y - 62);
	}

	drawMonster(ctx, m, now) {
		const kind = this.kinds[m.type];
		if (!kind) return;
		const sprite = monsterSprite(kind.kind, kind.color);
		const S = Math.max(2, Math.round((kind.radius * 3.2) / sprite.height));
		const w = sprite.width * S, h = sprite.height * S;
		ctx.save();
		ctx.fillStyle = "rgba(0,0,0,0.4)";
		ctx.beginPath(); ctx.ellipse(m.x, m.y + kind.radius * 0.8, kind.radius, kind.radius * 0.4, 0, 0, 6.3); ctx.fill();
		let shake = 0;
		if (m.state === 1) shake = Math.sin(now / 20) * 2;
		ctx.translate(Math.round(m.x + shake), 0);
		ctx.scale(m.face < 0 ? -1 : 1, 1);
		const bob = kind.kind === "bat" || kind.kind === "ghost" ? Math.sin(now / 160 + m.id) * 4 - 8 : 0;
		if (m.hurt) ctx.filter = "brightness(2.2)";
		ctx.drawImage(sprite, -w / 2, Math.round(m.y + kind.radius * 0.8 - h + bob), w, h);
		ctx.restore();
		if (m.state === 1) {
			ctx.strokeStyle = "rgba(255,40,40,0.9)"; ctx.lineWidth = 3;
			ctx.beginPath(); ctx.arc(m.x, m.y, kind.radius + 10 + Math.sin(now / 40) * 2, 0, 6.3); ctx.stroke();
		}
		if (m.hp < m.maxHp) this.drawBar(ctx, m.x, m.y - kind.radius - h * 0.55, Math.max(24, kind.radius * 2), m.hp / m.maxHp, "#c41e35");
	}

	drawShots(ctx, now) {
		for (const s of this.v.shots) {
			const g = ctx.createRadialGradient(s.x, s.y, 1, s.x, s.y, 14);
			g.addColorStop(0, "#fff"); g.addColorStop(0.35, "#d27bff"); g.addColorStop(1, "rgba(120,30,200,0)");
			ctx.fillStyle = g;
			ctx.beginPath(); ctx.arc(s.x, s.y, 14 + Math.sin(now / 50 + s.id) * 2, 0, 6.3); ctx.fill();
		}
	}

	drawFx(ctx, now) {
		this.fx = this.fx.filter((f) => now - f.t0 < 900);
		for (const f of this.fx) {
			const age = (now - f.t0) / 1000;
			if (age < 0) continue;
			if (f.k === "claw" && age < 0.22) {
				const owner = this.v.players.get(f.p);
				const ox = owner ? owner.x : f.x, oy = owner ? owner.y : f.y;
				ctx.strokeStyle = `rgba(255,235,220,${1 - age / 0.22})`; ctx.lineWidth = 3;
				for (const r of [34, 48, 62]) {
					ctx.beginPath(); ctx.arc(ox, oy, r, f.a - CLAW.arc / 2 + age * 2, f.a + CLAW.arc / 2 - age * 2); ctx.stroke();
				}
			} else if (f.k === "cast" && age < 0.15) {
				ctx.fillStyle = `rgba(200,120,255,${0.8 - age * 5})`;
				ctx.beginPath(); ctx.arc(f.x + Math.cos(f.a) * 24, f.y + Math.sin(f.a) * 24, 12 - age * 40, 0, 6.3); ctx.fill();
			} else if (f.k === "puff" && age < 0.2) {
				ctx.fillStyle = `rgba(200,140,255,${0.7 - age * 3.5})`;
				ctx.beginPath(); ctx.arc(f.x, f.y, 6 + age * 40, 0, 6.3); ctx.fill();
			} else if (f.k === "hit" && age < 0.7) {
				ctx.font = "bold 18px VT323, monospace"; ctx.textAlign = "center";
				ctx.globalAlpha = 1 - age / 0.7;
				ctx.lineWidth = 3; ctx.strokeStyle = "#000";
				const y = f.y - age * 50;
				ctx.strokeText(String(f.n), f.x, y);
				ctx.fillStyle = f.me ? "#ff4a4a" : f.m ? "#e0a0ff" : "#fff1a8";
				ctx.fillText(String(f.n), f.x, y);
				ctx.globalAlpha = 1;
			} else if (f.k === "boom" && age < 0.5) {
				ctx.fillStyle = f.c || "#c41e35";
				ctx.globalAlpha = 1 - age / 0.5;
				for (const p of f.parts) ctx.fillRect(f.x + Math.cos(p.a) * p.s * age - 3, f.y + Math.sin(p.a) * p.s * age - 3, 6, 6);
				ctx.globalAlpha = 1;
			} else if (f.k === "bite" && age < 0.15) {
				ctx.strokeStyle = `rgba(255,60,60,${1 - age / 0.15})`; ctx.lineWidth = 5;
				ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.tx, f.ty); ctx.stroke();
			}
		}
	}
}
