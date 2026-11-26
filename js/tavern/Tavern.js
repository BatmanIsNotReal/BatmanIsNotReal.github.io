// The tavern, as the player sees it: one big room for everybody. No fighting.
//   - click the floor to stand there (if the spot is free)
//   - just type: the letters show in a bubble above your head while you type, Enter sends it to everybody
//   - right-click another player: Dice / Page / Add friend / Trade
// The server (server.js, /ws/tavern) decides where everybody stands; the shape of the room is shared
// with it in layout.mjs.
import { ROOM, FLOOR, FURNITURE, STOOLS, STOOL_OFFSETS, STOOL_LIFT, MAX_SAY, SAY_SHOW_MS, spotProblem, stoolAt, snapToStool } from "./layout.mjs";
import { drawAvatar, defaultAvatar, normalizeAvatar } from "../profile/Avatar.js";

const RESOURCES = [["blood", "Blood"], ["humanFood", "Human food"], ["wood", "Wood"], ["iron", "Iron"], ["bronze", "Bronze"], ["gold", "Gold"]];
const MOVE_COOLDOWN_MS = 120;

// A small repeatable random number generator, so the floor looks the same every time
function seeded(seed) {
	let s = seed >>> 0;
	return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export default class Tavern {
	constructor(document, options) {
		this.document = document;
		this.o = options;
		this.active = false;
		this.built = false;
		this.players = new Map();     // pid -> { name, avatar, helmet, level, x, y, face }
		this.bubbles = new Map();     // pid -> { text, until }
		this.avatars = new Map();
		this.effects = [];            // little puffs where somebody appeared
		this.me = null;
		this.draft = "";
		this.lastMove = 0;
		this.trade = null;
		this.menuPid = null;
	}

	// ---------- Building the page ----------
	build() {
		if (this.built) return;
		this.built = true;
		const d = this.document;
		const el = (tag, className, text) => { const n = d.createElement(tag); if (className) n.className = className; if (text !== undefined) n.textContent = text; return n; };
		this.el = el;

		this.overlay = el("div", "ug-overlay tv-overlay");
		this.stage = el("div", "tv-stage");
		this.canvas = el("canvas", "tv-canvas");
		this.canvas.width = ROOM.width; this.canvas.height = ROOM.height;
		this.ctx = this.canvas.getContext("2d", { alpha: false });
		this.stage.append(this.canvas);

		this.top = el("div", "ug-top");
		this.title = el("span", "ug-title", "The Thirsty Fang");
		this.count = el("span", "ug-net", "");
		this.ping = el("span", "ug-net", "");
		this.top.append(this.title, this.count, this.ping);

		this.leave = el("button", "button ug-leave", "Leave tavern");
		this.leave.type = "button";
		this.leave.addEventListener("click", () => this.close());

		this.help = el("div", "tv-help", "Click the floor to walk. Just type to talk, Enter to send. Right-click a player for Dice, Page, Add friend and Trade.");

		this.log = el("div", "tv-log");

		this.menu = el("div", "tv-menu");
		this.menu.hidden = true;

		this.request = el("div", "tv-request");
		this.request.hidden = true;

		this.tradeBox = el("div", "tv-trade");
		this.tradeBox.hidden = true;

		this.overlay.append(this.stage, this.top, this.leave, this.help, this.log, this.menu, this.request, this.tradeBox);
		d.body.appendChild(this.overlay);

		this.canvas.addEventListener("click", (e) => this.onClick(e));
		this.canvas.addEventListener("contextmenu", (e) => this.onContext(e));
		this.overlay.addEventListener("contextmenu", (e) => e.preventDefault());
		this.overlay.addEventListener("mousedown", (e) => { if (!this.menu.contains(e.target)) this.closeMenu(); });
		d.addEventListener("keydown", (e) => this.onKey(e));
		window.addEventListener("resize", () => this.resize());
		this.paintRoom();
	}

	// ---------- Opening and closing ----------
	async open() {
		if (this.active) return;
		this.build();
		this.active = true;
		this.players.clear(); this.bubbles.clear(); this.effects = [];
		this.me = null; this.draft = ""; this.trade = null;
		this.log.textContent = "";
		this.closeMenu(); this.request.hidden = true; this.tradeBox.hidden = true;
		this.document.body.classList.add("ug-active", "tv-active");
		this.help.style.opacity = 1;
		clearTimeout(this.helpTimer);
		this.helpTimer = setTimeout(() => { this.help.style.opacity = 0; }, 20000);
		this.overlay.classList.add("open");
		this.resize();
		this.addLog("", "Connecting...", "note");
		try { if (this.o.prepare) await this.o.prepare(); } catch { /* the server will say if it does not know you */ }
		if (!this.active) return;
		const me = this.o.getPlayer();
		this.ws = new WebSocket(this.o.url);
		this.ws.onopen = () => this.send({ t: "join", id: me.id });
		this.ws.onmessage = (event) => { try { this.receive(JSON.parse(event.data)); } catch { /* ignore a broken message */ } };
		this.ws.onclose = () => { if (this.active) this.close("The connection to the tavern was lost."); };
		this.ws.onerror = () => {};
		this.pingTimer = setInterval(() => this.send({ t: "ping", c: performance.now() }), 3000);
		this.frame = requestAnimationFrame((t) => this.draw(t));
		this.lastDraw = 0;
	}

	close(message) {
		if (!this.active) return;
		this.active = false;
		cancelAnimationFrame(this.frame);
		clearInterval(this.pingTimer);
		try { this.send({ t: "leave" }); this.ws.close(); } catch { /* already closed */ }
		this.overlay.classList.remove("open");
		this.document.body.classList.remove("ug-active", "tv-active");
		this.closeMenu();
		if (this.o.onClose) this.o.onClose(message);
	}

	send(message) {
		if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(message));
	}

	// ---------- Messages from the server ----------
	receive(m) {
		if (m.t === "hello") {
			this.me = m.you;
			for (const pid in m.players) this.players.set(pid, { ...m.players[pid] });
			this.log.textContent = "";
			this.addLog("", "You step into the tavern.", "note");
			this.updateCount();
		} else if (m.t === "join") {
			this.players.set(m.pid, { ...m.info });
			this.effects.push({ x: m.info.x, y: m.info.y, at: performance.now() });
			this.addLog("", m.info.name + " came in.", "note");
			this.updateCount();
		} else if (m.t === "left") {
			const p = this.players.get(m.pid);
			if (p) this.addLog("", p.name + " left.", "note");
			this.players.delete(m.pid); this.bubbles.delete(m.pid); this.avatars.delete(m.pid);
			if (this.menuPid === m.pid) this.closeMenu();
			this.updateCount();
		} else if (m.t === "p") {
			const p = this.players.get(m.pid);
			if (!p) return;
			this.effects.push({ x: p.x, y: p.y, at: performance.now() });
			p.x = m.x; p.y = m.y; if (m.face) p.face = m.face;
			this.effects.push({ x: p.x, y: p.y, at: performance.now() });
		} else if (m.t === "you") {
			const p = this.players.get(this.me);
			if (p) { p.x = m.x; p.y = m.y; }
			if (m.error) this.addLog("", m.error, "bad");
		} else if (m.t === "say") {
			const p = this.players.get(m.pid);
			if (!p) return;
			this.bubbles.set(m.pid, { text: m.text, until: performance.now() + SAY_SHOW_MS });
			this.addLog(p.name, m.text, m.pid === this.me ? "mine" : "");
		} else if (m.t === "notice") {
			this.addLog("", m.text, "note");
		} else if (m.t === "error") {
			this.close(m.error);
		} else if (m.t === "pong") {
			const ms = Math.round(performance.now() - m.c);
			this.ping.textContent = ms + " ms";
			this.ping.className = "ug-net " + (ms < 90 ? "good" : ms < 180 ? "ok" : "bad");
		} else if (m.t === "tradeRequest") {
			this.showRequest(m);
		} else if (m.t === "tradeRequestEnd") {
			this.request.hidden = true;
		} else if (m.t === "trade") {
			this.showTrade(m);
		} else if (m.t === "tradeEnd") {
			this.endTrade(m);
		}
	}

	updateCount() {
		this.count.textContent = this.players.size + (this.players.size === 1 ? " person here" : " people here");
	}

	addLog(name, text, kind = "") {
		const line = this.el("div", "tv-line " + kind);
		if (name) { const b = this.el("b", "", name + ": "); line.append(b); }
		line.append(this.document.createTextNode(text));
		this.log.append(line);
		while (this.log.children.length > 9) this.log.firstChild.remove();
		setTimeout(() => line.classList.add("old"), 12000);
	}

	// ---------- Moving and typing ----------
	toRoom(e) {
		const r = this.canvas.getBoundingClientRect();
		return { x: (e.clientX - r.left) / r.width * ROOM.width, y: (e.clientY - r.top) / r.height * ROOM.height };
	}

	others() {
		const list = [];
		for (const [pid, p] of this.players) if (pid !== this.me) list.push(p);
		return list;
	}

	onClick(e) {
		this.closeMenu();
		const me = this.players.get(this.me);
		if (!me) return;
		const now = performance.now();
		if (now - this.lastMove < MOVE_COOLDOWN_MS) return;
		const clicked = this.toRoom(e);
		const { x, y } = snapToStool(clicked.x, clicked.y);
		const problem = spotProblem(x, y, this.others());
		if (problem) { this.addLog("", problem, "bad"); return; }
		this.lastMove = now;
		// show it at once; the server corrects us if it disagrees
		this.effects.push({ x: me.x, y: me.y, at: now });
		if (Math.abs(x - me.x) > 4) me.face = x < me.x ? -1 : 1;
		me.x = Math.round(x); me.y = Math.round(y);
		this.effects.push({ x: me.x, y: me.y, at: now });
		this.send({ t: "move", x: me.x, y: me.y });
	}

	onKey(e) {
		if (!this.active) return;
		const t = e.target;
		if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
		if (e.ctrlKey || e.metaKey || e.altKey) return;
		if (e.key === "Escape") {
			e.preventDefault();
			if (!this.menu.hidden) this.closeMenu();
			else if (this.draft) this.draft = "";
			else if (this.tradeBox.hidden) this.close();
			return;
		}
		if (e.key === "Enter") {
			e.preventDefault();
			const text = this.draft.trim();
			this.draft = "";
			if (text) this.send({ t: "say", text });
			return;
		}
		if (e.key === "Backspace") { e.preventDefault(); this.draft = this.draft.slice(0, -1); return; }
		if (e.key.length === 1) {
			e.preventDefault();
			if (this.draft.length < MAX_SAY) this.draft += e.key;
		}
	}

	// ---------- The menu on right-click ----------
	playerAt(x, y) {
		let best = null, bestDistance = 1e9;
		for (const [pid, p] of this.players) {
			if (pid === this.me) continue;
			if (Math.abs(x - p.x) > 32 || y < p.y - 80 || y > p.y + 26) continue;
			const dist = Math.abs(x - p.x) + Math.abs(y - p.y);
			if (dist < bestDistance) { best = pid; bestDistance = dist; }
		}
		return best;
	}

	onContext(e) {
		e.preventDefault();
		const pid = this.playerAt(...Object.values(this.toRoom(e)));
		if (!pid) { this.closeMenu(); return; }
		this.openMenu(pid);
	}

	openMenu(pid) {
		const p = this.players.get(pid);
		if (!p) return;
		this.menuPid = pid;
		const r = this.canvas.getBoundingClientRect();
		const scale = r.width / ROOM.width;
		const m = this.menu;
		m.textContent = "";
		m.append(this.el("div", "tv-menu-name", p.name + " (level " + p.level + ")"));
		const add = (label, action) => {
			const b = this.el("button", "tv-menu-item", label);
			b.type = "button";
			b.addEventListener("click", () => { this.closeMenu(); action(p, pid); });
			m.append(b);
		};
		add("Dice", (pl) => this.o.openDice(pl.name));
		add("Page", (pl) => this.o.openPage(pl.name));
		add("Add friend", (pl) => this.o.addFriend(pl.name).then((res) => this.addLog("", res.ok ? res.message : res.error, res.ok ? "note" : "bad")));
		add("Trade", (p2, id) => { this.send({ t: "tradeRequest", to: id }); this.addLog("", "Asking " + p2.name + " to trade...", "note"); });
		m.hidden = false;
		// the box starts at their waist and hangs down from there
		const left = Math.min(r.left + p.x * scale + 14, innerWidth - m.offsetWidth - 6);
		const top = Math.min(r.top + (p.y - 4) * scale, innerHeight - m.offsetHeight - 6);
		m.style.left = Math.max(4, left) + "px";
		m.style.top = Math.max(4, top) + "px";
	}

	closeMenu() {
		this.menuPid = null;
		if (this.menu) this.menu.hidden = true;
	}

	// ---------- Trading ----------
	showRequest(m) {
		const box = this.request;
		box.textContent = "";
		box.append(this.el("span", "", m.name + " would like to trade with you. "));
		const yes = this.el("button", "button", "Accept"); yes.type = "button";
		const no = this.el("button", "button", "Decline"); no.type = "button";
		yes.addEventListener("click", () => { this.send({ t: "tradeReply", accept: true }); box.hidden = true; });
		no.addEventListener("click", () => { this.send({ t: "tradeReply", accept: false }); box.hidden = true; });
		box.append(yes, no);
		box.hidden = false;
	}

	have() {
		const items = this.o.getItems();
		const have = {};
		for (const [key] of RESOURCES) have[key] = Math.max(0, Math.floor(items[key] || 0));
		return have;
	}

	readOffer() {
		const offer = {};
		const have = this.have();
		for (const [key] of RESOURCES) {
			const input = this.tradeInputs[key];
			let n = Math.floor(Number(input.value) || 0);
			n = Math.max(0, Math.min(n, have[key]));
			if (n) offer[key] = n;
		}
		return offer;
	}

	showTrade(m) {
		this.request.hidden = true;
		const box = this.tradeBox;
		const first = !this.trade;
		this.trade = m;
		if (first) {
			box.textContent = "";
			box.append(this.el("h3", "", "Trade with " + m.with.name));
			const cols = this.el("div", "tv-trade-cols");
			const mine = this.el("div", "tv-trade-col"), theirs = this.el("div", "tv-trade-col");
			mine.append(this.el("h4", "", "You give"));
			theirs.append(this.el("h4", "", m.with.name + " gives"));
			this.tradeInputs = {}; this.theirCells = {};
			const have = this.have();
			for (const [key, label] of RESOURCES) {
				const row = this.el("label", "tv-trade-row");
				row.append(this.el("span", "", label + " (" + have[key].toLocaleString("en-US") + ")"));
				const input = this.el("input"); input.type = "number"; input.min = 0; input.max = have[key]; input.value = 0;
				input.addEventListener("input", () => this.sendOffer());
				this.tradeInputs[key] = input;
				row.append(input);
				mine.append(row);
				const line = this.el("div", "tv-trade-row");
				line.append(this.el("span", "", label));
				const cell = this.el("b", "", "0");
				this.theirCells[key] = cell;
				line.append(cell);
				theirs.append(line);
			}
			cols.append(mine, theirs);
			this.tradeStatus = this.el("p", "tv-trade-status");
			const buttons = this.el("div", "tv-trade-buttons");
			this.acceptButton = this.el("button", "button", "Accept"); this.acceptButton.type = "button";
			const cancel = this.el("button", "button", "Cancel"); cancel.type = "button";
			this.acceptButton.addEventListener("click", () => {
				const ok = !this.trade.myOk;
				this.send({ t: "tradeAccept", ok, have: this.have() });
			});
			cancel.addEventListener("click", () => this.send({ t: "tradeCancel" }));
			buttons.append(this.acceptButton, cancel);
			box.append(cols, this.tradeStatus, buttons);
			box.hidden = false;
		}
		for (const [key] of RESOURCES) this.theirCells[key].textContent = ((m.theirs && m.theirs[key]) || 0).toLocaleString("en-US");
		this.acceptButton.textContent = m.myOk ? "Accepted (click to undo)" : "Accept";
		this.acceptButton.classList.toggle("on", !!m.myOk);
		this.tradeStatus.textContent = m.myOk && m.theirOk ? "Both agreed..." : m.theirOk ? m.with.name + " has accepted." : m.myOk ? "Waiting for " + m.with.name + "..." : "Change the numbers, then both press Accept. Any change cancels earlier accepts.";
	}

	sendOffer() {
		clearTimeout(this.offerTimer);
		this.offerTimer = setTimeout(() => this.send({ t: "tradeOffer", offer: this.readOffer(), have: this.have() }), 180);
	}

	endTrade(m) {
		this.trade = null;
		this.tradeBox.hidden = true;
		this.addLog("", m.reason || (m.done ? "Trade complete." : "Trade ended."), m.done ? "note" : "bad");
		if (m.done && this.o.onTraded) this.o.onTraded();
	}

	// ---------- Drawing ----------
	resize() {
		const w = innerWidth, h = innerHeight;
		const scale = Math.min(w / ROOM.width, h / ROOM.height);
		this.canvas.style.width = Math.floor(ROOM.width * scale) + "px";
		this.canvas.style.height = Math.floor(ROOM.height * scale) + "px";
	}

	avatarFor(pid) {
		const info = this.players.get(pid) || {};
		const avatar = normalizeAvatar(info.avatar || defaultAvatar(info.name || pid));
		const key = JSON.stringify(avatar) + ":" + (info.helmet || 0);
		let entry = this.avatars.get(pid);
		if (!entry || entry.key !== key) {
			const canvas = this.document.createElement("canvas");
			drawAvatar(canvas, avatar, info.helmet || 0);
			entry = { key, canvas };
			this.avatars.set(pid, entry);
		}
		return entry.canvas;
	}

	draw(now) {
		if (!this.active) return;
		this.frame = requestAnimationFrame((t) => this.draw(t));
		if (now - this.lastDraw < 30) return; // about 30 pictures a second is plenty here
		this.lastDraw = now;
		const ctx = this.ctx;
		ctx.drawImage(this.room, 0, 0);
		this.drawLive(ctx, now);
		const list = [...this.players.entries()].sort((a, b) => a[1].y - b[1].y);
		for (const fx of this.effects) {
			const age = (now - fx.at) / 450;
			if (age >= 1) continue;
			ctx.strokeStyle = `rgba(255, 226, 160, ${0.6 * (1 - age)})`; ctx.lineWidth = 3;
			ctx.beginPath(); ctx.ellipse(fx.x, fx.y + 16, 10 + 28 * age, 4 + 11 * age, 0, 0, 6.3); ctx.stroke();
		}
		this.effects = this.effects.filter((fx) => now - fx.at < 450);
		for (const [pid, p] of list) this.drawPlayer(ctx, pid, p, now);
		for (const [pid, p] of list) this.drawSpeech(ctx, pid, p, now);
		ctx.drawImage(this.lighting, 0, 0);
	}

	drawPlayer(ctx, pid, p) {
		const sprite = this.avatarFor(pid);
		const S = 3, w = sprite.width * S, h = sprite.height * S;
		const mine = pid === this.me;
		const lift = stoolAt(p.x, p.y) ? STOOL_LIFT : 0; // sitting on a stool
		ctx.save();
		ctx.fillStyle = "rgba(0,0,0,0.4)";
		ctx.beginPath(); ctx.ellipse(p.x, p.y + 16, 18, 7, 0, 0, 6.3); ctx.fill();
		ctx.translate(Math.round(p.x), 0);
		ctx.scale(p.face < 0 ? -1 : 1, 1);
		ctx.drawImage(sprite, -w / 2, Math.round(p.y + 18 - h - lift), w, h);
		ctx.restore();
		ctx.font = "bold 20px VT323, monospace";
		ctx.textAlign = "center";
		ctx.lineWidth = 4; ctx.strokeStyle = "#000";
		ctx.strokeText(p.name || "", p.x, p.y - 62 - lift);
		ctx.fillStyle = mine ? "#ffd979" : "#eadfce";
		ctx.fillText(p.name || "", p.x, p.y - 62 - lift);
	}

	drawSpeech(ctx, pid, p, now) {
		let text = "", draft = false;
		if (pid === this.me && this.draft) { text = this.draft; draft = true; }
		else { const b = this.bubbles.get(pid); if (b && b.until > now) text = b.text; }
		if (!text) return;
		this.drawBubble(ctx, p.x, p.y - 74 - (stoolAt(p.x, p.y) ? STOOL_LIFT : 0), draft && Math.floor(now / 450) % 2 === 0 ? text + "|" : text, draft);
	}

	drawBubble(ctx, x, y, text, draft) {
		ctx.font = "22px VT323, monospace";
		ctx.textAlign = "left";
		const maxWidth = 300;
		const lines = [];
		let line = "";
		for (const word of text.split(" ")) {
			let w = word;
			while (ctx.measureText(w).width > maxWidth) { // a very long word is cut
				let cut = w.length - 1;
				while (cut > 1 && ctx.measureText(w.slice(0, cut)).width > maxWidth) cut--;
				if (line) { lines.push(line); line = ""; }
				lines.push(w.slice(0, cut)); w = w.slice(cut);
			}
			const tryLine = line ? line + " " + w : w;
			if (line && ctx.measureText(tryLine).width > maxWidth) { lines.push(line); line = w; } else line = tryLine;
		}
		if (line) lines.push(line);
		const width = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 28;
		const height = lines.length * 24 + 10;
		let left = Math.round(x - width / 2);
		left = Math.max(6, Math.min(ROOM.width - width - 6, left));
		const top = Math.round(y - height - 8);
		ctx.fillStyle = draft ? "rgba(40, 28, 20, 0.82)" : "rgba(14, 8, 10, 0.92)";
		ctx.fillRect(left, top, width, height);
		ctx.strokeStyle = draft ? "#8a7a5a" : "#c9a45f"; ctx.lineWidth = 2;
		if (draft) ctx.setLineDash([6, 4]);
		ctx.strokeRect(left, top, width, height);
		ctx.setLineDash([]);
		ctx.fillStyle = draft ? "#8a7a5a" : "#c9a45f";
		ctx.fillRect(Math.round(x) - 5, top + height, 10, 6);
		ctx.fillStyle = draft ? "#d8ccb6" : "#eadfce";
		lines.forEach((l, i) => ctx.fillText(l, left + 14, top + 22 + i * 24));
	}

	// the fire and the candles
	drawLive(ctx, now) {
		const t = now / 1000;
		// fireplace
		const fx = 1310, fy = 214;
		for (let i = 0; i < 5; i++) {
			const flick = Math.sin(t * (7 + i * 1.3) + i * 2) * 0.5 + 0.5;
			const hgt = 20 + flick * 18 + (i === 2 ? 12 : 0);
			const x = fx - 56 + i * 28;
			ctx.fillStyle = "#e8481a";
			ctx.beginPath(); ctx.moveTo(x - 13, fy); ctx.quadraticCurveTo(x - 6, fy - hgt * 0.7, x + (flick - 0.5) * 8, fy - hgt); ctx.quadraticCurveTo(x + 8, fy - hgt * 0.6, x + 13, fy); ctx.fill();
			ctx.fillStyle = "#ffc03a";
			ctx.beginPath(); ctx.moveTo(x - 7, fy); ctx.quadraticCurveTo(x - 3, fy - hgt * 0.45, x + (flick - 0.5) * 5, fy - hgt * 0.65); ctx.quadraticCurveTo(x + 4, fy - hgt * 0.4, x + 7, fy); ctx.fill();
		}
		// candles on the tables
		for (const f of FURNITURE) {
			if (f.kind !== "table") continue;
			const cx = f.cx + 14, cy = f.cy - 6;
			const flick = Math.sin(t * 9 + f.x) * 1.5;
			ctx.fillStyle = "#ffd36a";
			ctx.beginPath(); ctx.ellipse(cx, cy - 12, 3, 6 + flick * 0.4, 0, 0, 6.3); ctx.fill();
			ctx.fillStyle = "#fff2c0";
			ctx.beginPath(); ctx.ellipse(cx, cy - 11, 1.4, 3, 0, 0, 6.3); ctx.fill();
		}
	}

	// ---------- The room itself (painted once) ----------
	paintRoom() {
		const d = this.document;
		const make = () => { const c = d.createElement("canvas"); c.width = ROOM.width; c.height = ROOM.height; return c; };
		this.room = make();
		this.lighting = make();
		const ctx = this.room.getContext("2d");
		const rnd = seeded(7);

		// back wall: dark planks
		ctx.fillStyle = "#2c1a10"; ctx.fillRect(0, 0, ROOM.width, FLOOR.top + 20);
		for (let x = 0; x < ROOM.width; x += 40) {
			ctx.fillStyle = (x / 40) % 2 ? "#33200f" : "#3a2513"; ctx.fillRect(x, 0, 38, FLOOR.top + 20);
			ctx.fillStyle = "#1c0f08"; ctx.fillRect(x + 38, 0, 2, FLOOR.top + 20);
		}
		ctx.fillStyle = "#1c0f08"; ctx.fillRect(0, 0, ROOM.width, 14);
		ctx.fillStyle = "#4a2e18"; ctx.fillRect(0, 160, ROOM.width, 10); // rail along the wall
		// ceiling beams
		ctx.fillStyle = "#26150b";
		for (const x of [0, 400, 800, 1200, 1560]) ctx.fillRect(x, 0, 40, FLOOR.top + 20);

		// windows
		for (const x of [690, 930]) {
			ctx.fillStyle = "#0e0806"; ctx.fillRect(x - 8, 46, 116, 106);
			ctx.fillStyle = "#14203a"; ctx.fillRect(x, 54, 100, 90);
			ctx.fillStyle = "#e8d890";
			for (let i = 0; i < 6; i++) ctx.fillRect(x + 10 + rnd() * 80, 62 + rnd() * 40, 2, 2); // stars
			ctx.fillStyle = "#0e0806"; ctx.fillRect(x + 47, 54, 6, 90); ctx.fillRect(x, 96, 100, 6);
		}
		// sign
		ctx.fillStyle = "#0e0806"; ctx.fillRect(762, 14, 2, 18); ctx.fillRect(836, 14, 2, 18);
		ctx.fillStyle = "#5a3a1c"; ctx.fillRect(710, 26, 180, 26);
		ctx.strokeStyle = "#c9a45f"; ctx.lineWidth = 2; ctx.strokeRect(712, 28, 176, 22);
		ctx.fillStyle = "#f2d99a"; ctx.font = "20px VT323, monospace"; ctx.textAlign = "center"; ctx.fillText("THE THIRSTY FANG", 800, 46);

		// shelves of bottles over the bar
		for (const y of [92, 138]) {
			ctx.fillStyle = "#1c0f08"; ctx.fillRect(84, y, 530, 8);
			for (let x = 96; x < 600; x += 26 + rnd() * 14) {
				const colors = ["#7a1420", "#245a3a", "#c8963a", "#3a3a7a", "#6a2a5a"];
				ctx.fillStyle = colors[Math.floor(rnd() * colors.length)];
				const bh = 24 + rnd() * 14;
				ctx.fillRect(x, y - bh, 12, bh); ctx.fillRect(x + 3, y - bh - 8, 6, 8);
			}
		}

		// the floor
		for (let y = FLOOR.top - 20, row = 0; y < ROOM.height; y += 36, row++) {
			for (let x = -((row * 97) % 260); x < ROOM.width; x += 260) {
				const shade = 0.88 + rnd() * 0.2;
				ctx.fillStyle = `rgb(${Math.round(118 * shade)}, ${Math.round(76 * shade)}, ${Math.round(42 * shade)})`;
				ctx.fillRect(x, y, 258, 34);
				ctx.fillStyle = "rgba(255, 220, 160, 0.08)"; ctx.fillRect(x, y, 258, 3);
				ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(x + 258, y, 2, 34);
			}
			ctx.fillStyle = "rgba(0,0,0,0.38)"; ctx.fillRect(0, y + 34, ROOM.width, 2);
		}
		// floor against the wall: shadow
		const grad = ctx.createLinearGradient(0, FLOOR.top - 20, 0, FLOOR.top + 50);
		grad.addColorStop(0, "rgba(0,0,0,0.55)"); grad.addColorStop(1, "rgba(0,0,0,0)");
		ctx.fillStyle = grad; ctx.fillRect(0, FLOOR.top - 20, ROOM.width, 70);

		// a rug in the middle
		ctx.fillStyle = "#c9a45f"; ctx.fillRect(596, 561, 408, 148);
		ctx.fillStyle = "#6a1420"; ctx.fillRect(602, 567, 396, 136);
		ctx.strokeStyle = "#c9a45f"; ctx.lineWidth = 3; ctx.strokeRect(618, 583, 364, 104);
		for (let i = 0; i < 5; i++) { ctx.fillStyle = "#a02a38"; ctx.beginPath(); ctx.moveTo(800 - 120 + i * 60, 635); ctx.lineTo(800 - 90 + i * 60, 605); ctx.lineTo(800 - 60 + i * 60, 635); ctx.lineTo(800 - 90 + i * 60, 665); ctx.fill(); }

		// the door at the bottom
		ctx.fillStyle = "#0e0806"; ctx.fillRect(0, FLOOR.bottom + 8, ROOM.width, ROOM.height);
		ctx.fillStyle = "#3a2513"; ctx.fillRect(0, FLOOR.bottom + 8, ROOM.width, 6);
		ctx.fillStyle = "#6a4426"; ctx.fillRect(730, FLOOR.bottom + 8, 140, 28);
		ctx.fillStyle = "#2a1608"; ctx.fillRect(742, FLOOR.bottom + 14, 116, 22);

		// furniture
		for (const f of FURNITURE) {
			if (f.kind === "bar") this.paintBar(ctx, f);
			else if (f.kind === "table") this.paintTable(ctx, f, rnd);
			else if (f.kind === "barrel") this.paintBarrel(ctx, f);
			else if (f.kind === "hearth") this.paintHearth(ctx, f);
		}

		// light: dark corners, a warm glow by the fire and on each table
		const lc = this.lighting.getContext("2d");
		const v = lc.createRadialGradient(800, 520, 260, 800, 520, 1000);
		v.addColorStop(0, "rgba(10,4,2,0)"); v.addColorStop(1, "rgba(10,4,2,0.62)");
		lc.fillStyle = v; lc.fillRect(0, 0, ROOM.width, ROOM.height);
		lc.globalCompositeOperation = "lighter";
		const glow = (x, y, r, a) => {
			const g = lc.createRadialGradient(x, y, 0, x, y, r);
			g.addColorStop(0, `rgba(255,150,60,${a})`); g.addColorStop(1, "rgba(255,150,60,0)");
			lc.fillStyle = g; lc.fillRect(x - r, y - r, r * 2, r * 2);
		};
		glow(1310, 260, 380, 0.34);
		for (const f of FURNITURE) if (f.kind === "table") glow(f.cx + 14, f.cy - 10, 130, 0.16);
		glow(350, 230, 260, 0.14);
	}

	paintBar(ctx, f) {
		ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(f.x + 4, f.y + f.h, f.w, 14);
		ctx.fillStyle = "#4a2a14"; ctx.fillRect(f.x, f.y + 28, f.w, f.h - 28);
		for (let x = f.x + 20; x < f.x + f.w; x += 56) { ctx.fillStyle = "#3a200e"; ctx.fillRect(x, f.y + 34, 2, f.h - 40); }
		ctx.fillStyle = "#8a5a2c"; ctx.fillRect(f.x - 6, f.y, f.w + 12, 30);
		ctx.fillStyle = "#a8743a"; ctx.fillRect(f.x - 6, f.y, f.w + 12, 5);
		for (const x of [140, 260, 380, 500]) { // mugs
			ctx.fillStyle = "#d8cfc0"; ctx.fillRect(f.x + x - 70, f.y + 6, 14, 16);
			ctx.fillStyle = "#e8c050"; ctx.fillRect(f.x + x - 68, f.y + 8, 10, 4);
			ctx.fillStyle = "#d8cfc0"; ctx.fillRect(f.x + x - 56, f.y + 9, 4, 8);
		}
	}

	paintTable(ctx, f, rnd) {
		const cx = f.cx, cy = f.cy;
		ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(cx + 5, cy + 12, 64, 56, 0, 0, 6.3); ctx.fill();
		for (const [dx, dy] of STOOL_OFFSETS) {
			if (cy + dy < FLOOR.top + 4) continue;
			ctx.fillStyle = "#3a2010"; ctx.beginPath(); ctx.ellipse(cx + dx, cy + dy, 15, 11, 0, 0, 6.3); ctx.fill();
			ctx.fillStyle = "#6a4020"; ctx.beginPath(); ctx.ellipse(cx + dx, cy + dy - 3, 15, 10, 0, 0, 6.3); ctx.fill();
		}
		ctx.fillStyle = "#5a3418"; ctx.beginPath(); ctx.ellipse(cx, cy + 6, 62, 54, 0, 0, 6.3); ctx.fill();
		ctx.fillStyle = "#8a5a2c"; ctx.beginPath(); ctx.ellipse(cx, cy, 62, 54, 0, 0, 6.3); ctx.fill();
		ctx.strokeStyle = "#6a4220"; ctx.lineWidth = 2;
		for (const o of [-24, 0, 24]) { ctx.beginPath(); ctx.moveTo(cx - 58 * Math.cos(Math.asin(o / 54)), cy + o); ctx.lineTo(cx + 58 * Math.cos(Math.asin(o / 54)), cy + o); ctx.stroke(); }
		// a mug and a candle holder
		ctx.fillStyle = "#d8cfc0"; ctx.fillRect(cx - 34, cy - 12, 14, 16);
		ctx.fillStyle = "#e8c050"; ctx.fillRect(cx - 32, cy - 10, 10, 4);
		ctx.fillStyle = "#d8cfc0"; ctx.fillRect(cx - 20, cy - 8, 4, 8);
		ctx.fillStyle = "#e8e0d0"; ctx.fillRect(cx + 11, cy - 6, 6, 10);
	}

	paintBarrel(ctx, f) {
		ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(f.x + 36, f.y + 60, 34, 10, 0, 0, 6.3); ctx.fill();
		ctx.fillStyle = "#5a3418"; ctx.fillRect(f.x + 4, f.y + 2, f.w - 8, f.h - 6);
		ctx.fillStyle = "#7a4a22"; ctx.beginPath(); ctx.ellipse(f.x + f.w / 2, f.y + 6, f.w / 2 - 4, 10, 0, 0, 6.3); ctx.fill();
		ctx.fillStyle = "#3a2010"; ctx.fillRect(f.x + 4, f.y + 20, f.w - 8, 4); ctx.fillRect(f.x + 4, f.y + 44, f.w - 8, 4);
		ctx.fillStyle = "#c9a45f"; ctx.fillRect(f.x + f.w / 2 - 3, f.y + 30, 6, 10);
	}

	paintHearth(ctx, f) {
		ctx.fillStyle = "#4a4650"; ctx.fillRect(f.x - 20, 90, f.w + 40, f.h + 90);
		for (let y = 90; y < 90 + f.h + 90; y += 18) for (let x = f.x - 20 + ((y / 18) % 2) * 20; x < f.x + f.w + 20; x += 40) {
			ctx.fillStyle = "#5a5662"; ctx.fillRect(x + 2, y + 2, 36, 14);
		}
		ctx.fillStyle = "#14090a"; ctx.fillRect(f.x + 10, f.y - 36, f.w - 20, f.h + 36); // the opening
		ctx.fillStyle = "#6a3a1a"; ctx.fillRect(f.x + 40, f.y + 28, f.w - 80, 14); // logs
		ctx.fillStyle = "#7a7480"; ctx.fillRect(f.x - 26, f.y + f.h - 4, f.w + 52, 12); // ledge
	}
}
