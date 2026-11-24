// The underground, as the player sees it: a full-screen overlay with the fight, the controls and the HUD.
// The fight itself is calculated by the server (server.js runs js/underground/world.mjs for everybody);
// this file connects to it, sends what the player does and draws what comes back.
// With ?solo in the address the same World runs in the browser instead, for trying things out alone.
import { ARENA, PLAYER_RADIUS, CLAW, dungeonById, monstersOf } from "../rules.mjs";
import { World, TICK_RATE, obstaclesFor } from "./world.mjs";
import { drawAvatar, defaultAvatar, normalizeAvatar } from "../profile/Avatar.js";
import { monsterSprite } from "./sprites.js";

const THEMES = {
	1: { floor: "#1a1510", tile: "#211b14", wall: "#4a4036", glow: "#6a5a44" },
	2: { floor: "#15151a", tile: "#1c1c23", wall: "#53535f", glow: "#8c8ca0" },
	3: { floor: "#1d0e12", tile: "#26121a", wall: "#5c2a34", glow: "#8f3a4a" },
	4: { floor: "#1f1008", tile: "#2a160a", wall: "#6a3216", glow: "#d8641c" },
	5: { floor: "#0e0a14", tile: "#150f1f", wall: "#3a2a58", glow: "#7a4ad0" },
	6: { floor: "#160b0b", tile: "#1f0f0f", wall: "#5a1a1a", glow: "#c41e35" },
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
		this.mouse = { x: e.clientX - rect.left, y: e.clientY - rect.top };
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
		this.snap = null; this.prev = null; this.cam = { x: 0, y: 0 };
		this.roster = {}; this.avatars = new Map(); this.fx = []; this.feed = [];
		this.me = null; this.dead = false;
		this.obstacles = obstaclesFor(dungeonId);
		this.theme = THEMES[dungeonId] || THEMES[1];
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

	resize() {
		this.canvas.width = this.overlay.clientWidth || window.innerWidth;
		this.canvas.height = this.overlay.clientHeight || window.innerHeight;
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
		const players = new Map(m.p.map((a) => [a[0], { id: a[0], x: a[1], y: a[2], hp: a[3], maxHp: a[4], face: a[5], aim: a[6], dead: !!(a[7] & 1), shield: !!(a[7] & 2), kills: a[8] }]));
		const monsters = new Map(m.m.map((a) => [a[0], { id: a[0], type: a[1], x: a[2], y: a[3], hp: a[4], maxHp: a[5], state: a[6], face: a[7], hurt: a[8] }]));
		this.prev = this.snap;
		this.snap = { time: now, players, monsters, shots: m.b.map((a) => ({ id: a[0], x: a[1], y: a[2] })) };
		for (const fx of m.f) {
			const entry = { ...fx, t0: now };
			if (fx.k === "boom") entry.parts = Array.from({ length: 10 }, () => ({ a: Math.random() * 6.28, s: 40 + Math.random() * 90 }));
			this.fx.push(entry);
		}
		const mine = players.get(this.me);
		if (mine) {
			this.dead = mine.dead;
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
		const pos = this.pose(this.me, performance.now());
		let aim = 0;
		if (pos) aim = Math.atan2(this.mouse.y - (pos.y - this.cam.y), this.mouse.x - (pos.x - this.cam.x));
		this.conn.send({ t: "in", mx, my, aim: Math.round(aim * 100) / 100, claw: this.input.claw, fire: this.input.fire });
	}

	// ---- drawing ----
	pose(id, now) {
		if (!this.snap) return null;
		const cur = this.snap.players.get(id);
		if (!cur) return null;
		const before = this.prev?.players.get(id);
		return this.lerpEntity(before, cur, now);
	}

	lerpEntity(before, cur, now) {
		if (!before) return cur;
		const a = Math.max(0, Math.min(1, (now - this.snap.time) / (1000 / TICK_RATE)));
		return { ...cur, x: before.x + (cur.x - before.x) * a, y: before.y + (cur.y - before.y) * a };
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
		const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;
		ctx.imageSmoothingEnabled = false;
		ctx.fillStyle = "#050305";
		ctx.fillRect(0, 0, W, H);
		const me = this.snap ? this.pose(this.me, now) : null;
		const focus = me || { x: ARENA.width / 2, y: ARENA.height / 2 };
		this.cam = {
			x: ARENA.width <= W ? (ARENA.width - W) / 2 : Math.max(0, Math.min(ARENA.width - W, focus.x - W / 2)),
			y: ARENA.height <= H ? (ARENA.height - H) / 2 : Math.max(0, Math.min(ARENA.height - H, focus.y - H / 2)),
		};
		if (!this.snap) return;
		ctx.save();
		ctx.translate(-Math.round(this.cam.x), -Math.round(this.cam.y));
		this.drawFloor(ctx, W, H);
		this.drawObstacles(ctx);

		const things = [];
		for (const cur of this.snap.players.values()) things.push({ y: cur.y, kind: "p", e: this.lerpEntity(this.prev?.players.get(cur.id), cur, now) });
		for (const cur of this.snap.monsters.values()) things.push({ y: cur.y, kind: "m", e: this.lerpEntity(this.prev?.monsters.get(cur.id), cur, now) });
		things.sort((a, b) => a.y - b.y);
		for (const t of things) (t.kind === "p" ? this.drawPlayer(ctx, t.e, now) : this.drawMonster(ctx, t.e, now));
		this.drawShots(ctx, now);
		this.drawFx(ctx, now);
		ctx.restore();
	}

	drawFloor(ctx, W, H) {
		const T = 80;
		const x0 = Math.max(0, Math.floor(this.cam.x / T)), x1 = Math.min(Math.ceil(ARENA.width / T), Math.ceil((this.cam.x + W) / T));
		const y0 = Math.max(0, Math.floor(this.cam.y / T)), y1 = Math.min(Math.ceil(ARENA.height / T), Math.ceil((this.cam.y + H) / T));
		ctx.fillStyle = this.theme.floor;
		ctx.fillRect(0, 0, ARENA.width, ARENA.height);
		ctx.fillStyle = this.theme.tile;
		for (let y = y0; y < y1; y++) {
			for (let x = x0; x < x1; x++) {
				const h = Math.sin(x * 12.9898 + y * 78.233 + this.dungeonId) * 43758.5453;
				const v = h - Math.floor(h);
				if (v < 0.35) ctx.fillRect(x * T + 4, y * T + 4, T - 8, T - 8);
				else if (v > 0.93) { ctx.fillStyle = this.theme.wall; ctx.fillRect(x * T + 30, y * T + 30, 6, 4); ctx.fillStyle = this.theme.tile; }
			}
		}
		ctx.strokeStyle = this.theme.glow;
		ctx.lineWidth = 6;
		ctx.strokeRect(0, 0, ARENA.width, ARENA.height);
		// the way you came in (not in the Abyss)
		if (!this.pvp) {
			ctx.fillStyle = "rgba(255,255,255,0.06)";
			ctx.beginPath(); ctx.arc(160, ARENA.height / 2, 90, 0, 6.3); ctx.fill();
		}
	}

	drawObstacles(ctx) {
		for (const o of this.obstacles) {
			if (o.x + o.r < this.cam.x || o.x - o.r > this.cam.x + this.canvas.width || o.y + o.r < this.cam.y || o.y - o.r > this.cam.y + this.canvas.height) continue;
			ctx.fillStyle = "rgba(0,0,0,0.35)";
			ctx.beginPath(); ctx.ellipse(o.x + 6, o.y + o.r * 0.7, o.r, o.r * 0.55, 0, 0, 6.3); ctx.fill();
			ctx.fillStyle = this.theme.wall;
			ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 6.3); ctx.fill();
			ctx.fillStyle = "rgba(255,255,255,0.09)";
			ctx.beginPath(); ctx.arc(o.x - o.r * 0.25, o.y - o.r * 0.25, o.r * 0.6, 0, 6.3); ctx.fill();
			ctx.strokeStyle = "#0a0608"; ctx.lineWidth = 3;
			ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 6.3); ctx.stroke();
		}
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
		for (const s of this.snap.shots) {
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
			if (f.k === "claw" && age < 0.22) {
				const owner = this.snap.players.get(f.p);
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
