// The tavern, as the player sees it: one big room for everybody. No fighting.
//   - click the floor to stand there (if the spot is free)
//   - just type: the letters show in a bubble above your head while you type, Enter sends it to everybody
//   - right-click another player: Dice / Page / Add friend / Trade
// The server (server.js, /ws/tavern) decides where everybody stands; the shape of the room is shared
// with it in layout.mjs.
import { ROOM, FLOOR, FURNITURE, STOOLS, STOOL_OFFSETS, STOOL_LIFT, MAX_SAY, SAY_SHOW_MS, spotProblem, stoolAt, snapToStool, furnitureType, itemType, backgroundType } from "./layout.mjs";
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
		this.rooms = { tavern: { room: this.room, lighting: this.lighting } };
		this.mansionRooms = { default: this.paintMansionRoom("default") };
		this.rooms.mansion = this.mansionRooms.default;
	}

	// The mansion room with a given background (painted once, then kept)
	mansionRoom(id) {
		const key = backgroundType(id) ? id : "default";
		if (!this.mansionRooms[key]) this.mansionRooms[key] = this.paintMansionRoom(key);
		return this.mansionRooms[key];
	}

	// ---------- Opening and closing ----------
	// opts.visit: the name of a player whose mansion to visit (without it you go to the tavern)
	async open(opts = {}) {
		if (this.active) return;
		this.build();
		this.visit = opts.visit || null;
		this.kind = "tavern"; this.isOwner = false; this.furn = [];
		this.room = this.rooms.tavern.room; this.lighting = this.rooms.tavern.lighting;
		this.title.textContent = this.visit ? this.visit + "'s mansion" : "The Thirsty Fang";
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
		this.ws.onopen = () => this.send({ t: "join", id: me.id, visit: this.visit });
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
			this.kind = m.room ? m.room.kind : "tavern";
			this.isOwner = !!(m.room && m.room.mine);
			this.furn = m.furniture || [];
			this.bg = m.background || "default";
			const painted = this.kind === "mansion" ? this.mansionRoom(this.bg) : this.rooms[this.kind];
			this.room = painted.room; this.lighting = painted.lighting;
			this.title.textContent = this.kind === "mansion" ? m.room.owner + "'s mansion" : "The Thirsty Fang";
			this.help.textContent = this.kind === "mansion"
				? (this.isOwner ? "Click the floor to walk. Right-click yourself to open your inventory and drop furniture; right-click a piece to pick it up or a visitor to send them out." : "Click the floor to walk. Just type to talk, Enter to send. Right-click a player for Dice, Page, Add friend, Trade and their inventory.")
				: "Click the floor to walk. Just type to talk, Enter to send. Right-click a player for Dice, Page, Add friend, Trade and their inventory.";
			for (const pid in m.players) this.players.set(pid, { ...m.players[pid] });
			this.log.textContent = "";
			this.addLog("", this.kind === "mansion" ? "You step into the mansion." : "You step into the tavern.", "note");
			this.leave.textContent = this.kind === "mansion" ? "Leave mansion" : "Leave tavern";
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
		} else if (m.t === "inv") {
			if (this.menuPid === m.pid) this.fillInventory(m.items);
		} else if (m.t === "furnAdd") {
			this.furn.push(m.item);
		} else if (m.t === "furnDel") {
			this.furn = this.furn.filter((i) => i.uid !== m.uid);
		} else if (m.t === "bg") {
			this.bg = m.id;
			const painted = this.mansionRoom(m.id);
			this.room = painted.room; this.lighting = painted.lighting;
			this.addLog("", m.id === "default" ? "The owner took the background down." : "The owner hung a new background: " + backgroundType(m.id).name + ".", "note");
		} else if (m.t === "kicked") {
			this.close(m.reason);
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
		const { x, y } = this.kind === "tavern" ? snapToStool(clicked.x, clicked.y) : clicked;
		const problem = spotProblem(x, y, this.others(), this.kind);
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
			if (Math.abs(x - p.x) > 32 || y < p.y - 80 || y > p.y + 26) continue;
			const dist = Math.abs(x - p.x) + Math.abs(y - p.y);
			if (dist < bestDistance) { best = pid; bestDistance = dist; }
		}
		return best;
	}

	// A piece of furniture under the pointer (the one in front wins)
	furnitureAt(x, y) {
		const box = { chair: [24, 42, 18], table: [78, 36, 24], sofa: [64, 42, 18], fireplace: [66, 78, 18], rare: [46, 125, 18] };
		let best = null;
		for (const item of this.furn) {
			const type = furnitureType(item.type);
			if (!type) continue;
			const [hx, up, down] = box[type.kind];
			if (Math.abs(x - item.x) <= hx && y >= item.y - up && y <= item.y + down && (!best || item.y > best.y)) best = item;
		}
		return best;
	}

	onContext(e) {
		e.preventDefault();
		const at = this.toRoom(e);
		const pid = this.playerAt(at.x, at.y);
		if (pid) return this.openMenu(pid);
		const item = this.kind === "mansion" && this.isOwner ? this.furnitureAt(at.x, at.y) : null;
		if (item) return this.openFurnitureMenu(item);
		this.closeMenu();
	}

	placeMenu(x, y) {
		const m = this.menu;
		if (x !== undefined) { this.menuX = x; this.menuY = y; }
		const left = Math.min(this.menuX, innerWidth - m.offsetWidth - 6);
		const top = Math.min(this.menuY, innerHeight - m.offsetHeight - 6);
		m.style.left = Math.max(4, left) + "px";
		m.style.top = Math.max(4, top) + "px";
	}

	menuButton(label, action, parent = this.menu) {
		const b = this.el("button", "tv-menu-item", label);
		b.type = "button";
		b.addEventListener("click", () => action(b));
		parent.append(b);
		return b;
	}

	// Right-click a piece of furniture in your own mansion
	openFurnitureMenu(item) {
		const type = furnitureType(item.type);
		const r = this.canvas.getBoundingClientRect();
		const scale = r.width / ROOM.width;
		this.menuPid = null;
		this.menu.textContent = "";
		this.menu.append(this.el("div", "tv-menu-name", type ? type.name : "Furniture"));
		this.menuButton("Pick up", () => { this.send({ t: "pickup", uid: item.uid }); this.closeMenu(); });
		this.menu.hidden = false;
		this.placeMenu(r.left + item.x * scale + 14, r.top + item.y * scale);
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
		const done = (fn) => () => { this.closeMenu(); fn(); };
		if (pid !== this.me) {
			this.menuButton("Dice", done(() => this.o.openDice(p.name)));
			this.menuButton("Page", done(() => this.o.openPage(p.name)));
			this.menuButton("Add friend", done(() => this.o.addFriend(p.name).then((res) => this.addLog("", res.ok ? res.message : res.error, res.ok ? "note" : "bad"))));
			this.menuButton("Trade", done(() => { this.send({ t: "tradeRequest", to: pid }); this.addLog("", "Asking " + p.name + " to trade...", "note"); }));
			if (this.kind === "mansion" && this.isOwner) this.menuButton("Send out", done(() => this.send({ t: "kick", pid })));
		}
		m.append(this.el("div", "tv-menu-section", "Inventory"));
		this.invBox = this.el("div", "tv-inv");
		this.invBox.append(this.el("div", "tv-inv-empty", "..."));
		m.append(this.invBox);
		m.hidden = false;
		// the box starts at their waist and hangs down from there
		this.placeMenu(r.left + p.x * scale + 14, r.top + (p.y - 4) * scale);
		this.send({ t: "inv", pid });
	}

	fillInventory(items) {
		const box = this.invBox;
		if (!box) return;
		box.textContent = "";
		const ids = Object.keys(items || {}).filter((id) => itemType(id) && items[id] > 0);
		const mineToPlace = this.menuPid === this.me && this.kind === "mansion" && this.isOwner;
		if (!ids.length && !(mineToPlace && this.bg !== "default")) box.append(this.el("div", "tv-inv-empty", "Nothing."));
		if (mineToPlace && this.bg !== "default") {
			const off = this.el("button", "tv-menu-item tv-inv-item", "Take the background down");
			off.type = "button";
			off.addEventListener("click", () => { this.send({ t: "bg", id: "default" }); this.closeMenu(); });
			box.append(off);
		}
		for (const id of ids) {
			const row = this.el("div", "tv-inv-row");
			const label = itemType(id).name + " x" + items[id];
			if (mineToPlace && itemType(id).kind === "background") {
				const use = this.el("button", "tv-menu-item tv-inv-item", label + " - hang it");
				use.type = "button";
				use.addEventListener("click", () => { this.send({ t: "bg", id }); this.closeMenu(); });
				row.append(use); box.append(row); continue;
			}
			if (!mineToPlace) { row.textContent = label; box.append(row); continue; }
			// your own items: right-click one (or click it) and press Drop
			const b = this.el("button", "tv-menu-item tv-inv-item", label);
			b.type = "button";
			const open = (e) => {
				e.preventDefault();
				const next = row.querySelector(".tv-drop");
				if (next) { next.remove(); return; }
				const drop = this.el("button", "tv-menu-item tv-drop", "Drop");
				drop.type = "button";
				drop.addEventListener("click", () => { this.send({ t: "drop", type: id }); this.closeMenu(); });
				row.append(drop);
				this.placeMenu();
			};
			b.addEventListener("contextmenu", open);
			b.addEventListener("click", open);
			row.append(b);
			box.append(row);
		}
		this.placeMenu();
	}

	closeMenu() {
		this.menuPid = null;
		this.invBox = null;
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

	readItems() {
		const items = {};
		for (const [id, input] of Object.entries(this.tradeItemInputs || {})) {
			const n = Math.max(0, Math.min(Math.floor(Number(input.value) || 0), Number(input.max) || 0));
			if (n) items[id] = n;
		}
		return items;
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
			// furniture and backgrounds (the server knows what you own)
			this.tradeItemInputs = {};
			const ownedIds = Object.keys(m.owned || {}).filter((id) => itemType(id) && m.owned[id] > 0);
			if (ownedIds.length) {
				mine.append(this.el("h4", "", "Furniture"));
				for (const id of ownedIds) {
					const row = this.el("label", "tv-trade-row");
					row.append(this.el("span", "", itemType(id).name + " (" + m.owned[id] + ")"));
					const input = this.el("input"); input.type = "number"; input.min = 0; input.max = m.owned[id]; input.value = 0;
					input.addEventListener("input", () => this.sendOffer());
					this.tradeItemInputs[id] = input;
					row.append(input);
					mine.append(row);
				}
			}
			theirs.append(this.el("h4", "", "Furniture"));
			this.theirItemsBox = this.el("div", "tv-trade-items", "none");
			theirs.append(this.theirItemsBox);
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
		const theirItems = Object.entries(m.theirItems || {}).filter(([, n]) => n > 0);
		this.theirItemsBox.textContent = theirItems.length ? theirItems.map(([id, n]) => n + " x " + (itemType(id) ? itemType(id).name : id)).join(", ") : "none";
		this.acceptButton.textContent = m.myOk ? "Accepted (click to undo)" : "Accept";
		this.acceptButton.classList.toggle("on", !!m.myOk);
		this.tradeStatus.textContent = m.myOk && m.theirOk ? "Both agreed..." : m.theirOk ? m.with.name + " has accepted." : m.myOk ? "Waiting for " + m.with.name + "..." : "Change the numbers, then both press Accept. Any change cancels earlier accepts.";
	}

	sendOffer() {
		clearTimeout(this.offerTimer);
		this.offerTimer = setTimeout(() => this.send({ t: "tradeOffer", offer: this.readOffer(), items: this.readItems(), have: this.have() }), 180);
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
		if (this.kind === "tavern") this.drawLive(ctx, now);
		for (const item of [...this.furn].sort((a, b) => a.y - b.y)) this.paintFurniture(ctx, item.type, item.x, item.y, now);
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
		const lift = this.kind === "tavern" && stoolAt(p.x, p.y) ? STOOL_LIFT : 0; // sitting on a stool
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
		this.drawBubble(ctx, p.x, p.y - 74 - (this.kind === "tavern" && stoolAt(p.x, p.y) ? STOOL_LIFT : 0), draft && Math.floor(now / 450) % 2 === 0 ? text + "|" : text, draft);
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

	// ---------- The mansion: an empty room ----------
	paintMansionRoom(bgId = "default") {
		const bg = backgroundType(bgId);
		const P = bg || { wallA: "#521e2e", wallB: "#44182a", trim: "#c9a45f", panel: "#2a1018", floor: [128, 88, 58], sky: "#14203a", style: "stripes", tiles: false };
		const d = this.document;
		const make = () => { const c = d.createElement("canvas"); c.width = ROOM.width; c.height = ROOM.height; return c; };
		const room = make(), lighting = make();
		const ctx = room.getContext("2d");
		const wallH = FLOOR.top + 20;
		ctx.fillStyle = P.wallB; ctx.fillRect(0, 0, ROOM.width, wallH);
		if (P.style === "bricks") {
			for (let y = 0, row = 0; y < wallH; y += 24, row++) for (let x = -((row % 2) * 30); x < ROOM.width; x += 60) {
				ctx.fillStyle = (x * 7 + y * 3) % 5 < 2 ? P.wallA : P.wallB; ctx.fillRect(x + 1, y + 1, 58, 22);
			}
		} else {
			for (let x = 0; x < ROOM.width; x += 60) {
				ctx.fillStyle = P.style === "stripes" && (x / 60) % 2 ? P.wallA : P.style === "stripes" ? P.wallB : P.wallA;
				ctx.fillRect(x, 0, 60, wallH);
				if (P.style === "stripes") { ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(x + 29, 20, 2, wallH - 70); }
			}
			if (P.style === "plain") { ctx.fillStyle = "rgba(255,255,255,0.07)"; for (let x = 30; x < ROOM.width; x += 60) for (let y = 40; y < 140; y += 40) ctx.fillRect(x, y, 4, 4); }
		}
		ctx.fillStyle = P.trim; ctx.fillRect(0, 0, ROOM.width, 12);
		ctx.fillStyle = P.panel; ctx.fillRect(0, 150, ROOM.width, 70); // panelling
		ctx.fillStyle = P.trim; ctx.fillRect(0, 148, ROOM.width, 4);
		for (let x = 20; x < ROOM.width; x += 120) { ctx.strokeStyle = "rgba(255,255,255,0.22)"; ctx.lineWidth = 2; ctx.strokeRect(x, 162, 100, 44); }
		for (const x of [380, 800, 1220]) { // tall windows
			ctx.fillStyle = P.trim; ctx.fillRect(x - 8, 24, 96, 118);
			ctx.fillStyle = P.sky; ctx.fillRect(x, 32, 80, 102);
			ctx.fillStyle = "#e8d890"; for (let i = 0; i < 5; i++) ctx.fillRect(x + 8 + ((i * 37) % 64), 40 + ((i * 23) % 40), 2, 2);
			ctx.fillStyle = P.trim; ctx.fillRect(x + 37, 32, 6, 102); ctx.fillRect(x, 80, 80, 6);
		}
		// the floor: boards, or large tiles in two shades
		const [fr, fg, fb] = P.floor;
		if (P.tiles) {
			for (let y = FLOOR.top - 20, row = 0; y < ROOM.height; y += 80, row++) for (let x = 0, col = 0; x < ROOM.width; x += 80, col++) {
				const k = (row + col) % 2 ? 1 : 0.86;
				ctx.fillStyle = `rgb(${Math.round(fr * k)}, ${Math.round(fg * k)}, ${Math.round(fb * k)})`; ctx.fillRect(x, y, 80, 80);
				ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(x, y, 80, 3);
				ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(x + 78, y, 2, 80); ctx.fillRect(x, y + 78, 80, 2);
			}
		} else {
			for (let y = FLOOR.top - 20, row = 0; y < ROOM.height; y += 40, row++) {
				for (let x = -((row * 83) % 200); x < ROOM.width; x += 200) {
					const shade = 0.94 + ((x * 7 + y * 13) % 17) / 170;
					ctx.fillStyle = `rgb(${Math.round(fr * shade)}, ${Math.round(fg * shade)}, ${Math.round(fb * shade)})`;
					ctx.fillRect(x, y, 198, 38);
					ctx.fillStyle = "rgba(255, 235, 190, 0.1)"; ctx.fillRect(x, y, 198, 3);
					ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(x + 198, y, 2, 38);
				}
				ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(0, y + 38, ROOM.width, 2);
			}
		}
		const grad = ctx.createLinearGradient(0, FLOOR.top - 20, 0, FLOOR.top + 60);
		grad.addColorStop(0, "rgba(0,0,0,0.45)"); grad.addColorStop(1, "rgba(0,0,0,0)");
		ctx.fillStyle = grad; ctx.fillRect(0, FLOOR.top - 20, ROOM.width, 80);
		ctx.fillStyle = "#0e0806"; ctx.fillRect(0, FLOOR.bottom + 8, ROOM.width, ROOM.height);
		ctx.fillStyle = P.trim; ctx.fillRect(0, FLOOR.bottom + 8, ROOM.width, 5);
		ctx.fillStyle = "#6a4426"; ctx.fillRect(730, FLOOR.bottom + 8, 140, 28);
		ctx.fillStyle = "#2a1608"; ctx.fillRect(742, FLOOR.bottom + 14, 116, 22);
		const lc = lighting.getContext("2d");
		const v = lc.createRadialGradient(800, 520, 320, 800, 520, 1050);
		v.addColorStop(0, "rgba(10,4,6,0)"); v.addColorStop(1, "rgba(10,4,6,0.5)");
		lc.fillStyle = v; lc.fillRect(0, 0, ROOM.width, ROOM.height);
		return { room, lighting };
	}

	// ---------- The furniture ----------
	// (x, y) is where the owner stood: the middle of the bottom of the piece
	paintFurniture(ctx, id, x, y, now) {
		const type = furnitureType(id);
		if (!type) return;
		const v = parseInt(id.replace(/\D/g, ""), 10) - 1;
		x = Math.round(x); y = Math.round(y);
		ctx.save();
		ctx.fillStyle = "rgba(0,0,0,0.32)";
		const wide = { chair: 20, table: [46, 50, 76, 46, 52][v] || 50, sofa: 62, fireplace: 64, rare: v === 10 ? 48 : v === 11 ? 36 : 26 }[type.kind];
		ctx.beginPath(); ctx.ellipse(x, y + 14, wide, 7, 0, 0, 6.3); ctx.fill();
		if (type.kind === "chair") this.paintChair(ctx, x, y, v);
		else if (type.kind === "table") this.paintTableItem(ctx, x, y, v);
		else if (type.kind === "sofa") this.paintSofa(ctx, x, y, v);
		else if (type.kind === "rare") this.paintRare(ctx, x, y, v, now);
		else this.paintFireplace(ctx, x, y, v, now);
		ctx.restore();
	}

	// The rare pieces. (x, y) is the middle of the bottom edge; v = 0..14 is the piece.
	paintRare(ctx, x, y, v, now) {
		const t = (now || 0) / 1000;
		const R = (c, dx, dy, w, h) => { ctx.fillStyle = c; ctx.fillRect(x + dx, y + dy, w, h); };
		const E = (c, dx, dy, rx, ry) => { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x + dx, y + dy, rx, ry, 0, 0, 6.3); ctx.fill(); };
		const flame = (fx, fy, k) => { const h = 8 + 4 * Math.sin(t * 9 + k); ctx.fillStyle = "#ff9a2a"; ctx.beginPath(); ctx.ellipse(fx, fy - h / 2, 3, h / 2, 0, 0, 6.3); ctx.fill(); ctx.fillStyle = "#ffe27a"; ctx.beginPath(); ctx.ellipse(fx, fy - h / 3, 1.5, h / 3, 0, 0, 6.3); ctx.fill(); };
		const pedestal = (c) => { R("#1a1410", -22, -4, 44, 18); R(c, -20, -2, 40, 14); R(c, -16, -26, 32, 24); R("rgba(255,255,255,0.15)", -16, -26, 32, 3); };
		if (v === 0) { // brass floor lamp
			E("#8a6a28", 0, 10, 18, 5); R("#c9a45f", -3, -112, 6, 120);
			const g = ctx.createRadialGradient(x, y - 118, 4, x, y - 118, 50); g.addColorStop(0, "rgba(255,225,140,0.55)"); g.addColorStop(1, "rgba(255,225,140,0)");
			ctx.fillStyle = g; ctx.fillRect(x - 55, y - 170, 110, 110);
			ctx.fillStyle = "#f0e2b4"; ctx.beginPath(); ctx.moveTo(x - 24, y - 92); ctx.lineTo(x + 24, y - 92); ctx.lineTo(x + 15, y - 128); ctx.lineTo(x - 15, y - 128); ctx.fill();
		} else if (v === 1) { // candelabra
			R("#9a9aa6", -14, 6, 28, 6); R("#c0c0cc", -4, -50, 8, 56);
			ctx.strokeStyle = "#c0c0cc"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - 26, y - 56); ctx.quadraticCurveTo(x - 26, y - 40, x, y - 40); ctx.quadraticCurveTo(x + 26, y - 40, x + 26, y - 56); ctx.stroke();
			for (const [i, dx] of [-26, 0, 26].entries()) { R("#f0ead8", dx - 3, -72, 6, 18); flame(x + dx, y - 72, i); }
		} else if (v === 2) { // grandfather clock
			R("#1a0f08", -26, -134, 52, 140); R("#6a4222", -24, -132, 48, 136); R("#7a5030", -28, -140, 56, 10);
			E("#efe6cc", 0, -104, 17, 17); ctx.strokeStyle = "#1a0f08"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - 104); ctx.lineTo(x + 8, y - 110); ctx.moveTo(x, y - 104); ctx.lineTo(x - 3, y - 118); ctx.stroke();
			R("#2a1a0c", -14, -76, 28, 60); const sw = Math.sin(t * 3) * 8; E("#c9a45f", sw, -26, 6, 6); R("#c9a45f", sw / 2 - 1, -70, 2, 44);
		} else if (v === 3) { // marble maiden
			pedestal("#cfc9c0"); E("#f2eee6", 0, -86, 9, 10);
			ctx.fillStyle = "#f2eee6"; ctx.beginPath(); ctx.moveTo(x - 10, y - 76); ctx.lineTo(x + 10, y - 76); ctx.lineTo(x + 20, y - 26); ctx.lineTo(x - 20, y - 26); ctx.fill();
			R("rgba(0,0,0,0.12)", 2, -74, 8, 48); R("#f2eee6", -24, -70, 8, 30);
		} else if (v === 4) { // bronze warrior
			pedestal("#4a3a28"); E("#a8743a", 0, -98, 10, 10); R("#8a5a28", -11, -108, 22, 6);
			R("#a8743a", -13, -88, 26, 36); R("#8a5a28", -11, -52, 9, 26); R("#8a5a28", 2, -52, 9, 26);
			R("#d0d0d8", 20, -120, 4, 80); R("#a8743a", 14, -92, 16, 4);
		} else if (v === 5) { // gargoyle
			pedestal("#6a6a70"); E("#8a8a92", 0, -46, 20, 14);
			ctx.fillStyle = "#6a6a72"; ctx.beginPath(); ctx.moveTo(x - 14, y - 52); ctx.lineTo(x - 44, y - 78); ctx.lineTo(x - 30, y - 40); ctx.fill(); ctx.beginPath(); ctx.moveTo(x + 14, y - 52); ctx.lineTo(x + 44, y - 78); ctx.lineTo(x + 30, y - 40); ctx.fill();
			E("#8a8a92", 0, -66, 11, 11); R("#8a8a92", -10, -80, 4, 8); R("#8a8a92", 6, -80, 4, 8); R("#e03a2a", -6, -68, 3, 3); R("#e03a2a", 3, -68, 3, 3);
		} else if (v === 6) { // suit of armour
			R("#6a6a74", -12, -22, 10, 26); R("#6a6a74", 2, -22, 10, 26); R("#8a8a96", -16, -70, 32, 50); R("#a4a4b0", -12, -66, 24, 18);
			E("#a4a4b0", 0, -86, 11, 13); R("#2a2a30", -7, -88, 14, 4); R("#c03030", -2, -104, 4, 12);
			R("#5a3a1a", 22, -124, 3, 124); ctx.fillStyle = "#c0c0cc"; ctx.beginPath(); ctx.moveTo(x + 18, y - 120); ctx.lineTo(x + 24, y - 142); ctx.lineTo(x + 30, y - 120); ctx.fill();
		} else if (v === 7) { // potted palm
			R("#1a0f08", -16, -26, 32, 30); R("#b0623a", -14, -24, 28, 26); R("#8a4a28", -17, -28, 34, 6);
			ctx.strokeStyle = "#2f7a3a"; ctx.lineWidth = 6; ctx.lineCap = "round";
			for (const a of [-1.2, -0.6, 0, 0.6, 1.2]) { ctx.beginPath(); ctx.moveTo(x, y - 26); ctx.quadraticCurveTo(x + Math.sin(a) * 30, y - 90 - Math.cos(a) * 12, x + Math.sin(a) * 52, y - 62 + Math.abs(a) * 10); ctx.stroke(); }
			ctx.lineCap = "butt";
		} else if (v === 8) { // harp
			R("#8a6a28", -26, 4, 52, 6); ctx.strokeStyle = "#c9a45f"; ctx.lineWidth = 6;
			ctx.beginPath(); ctx.moveTo(x - 24, y + 4); ctx.lineTo(x - 24, y - 100); ctx.quadraticCurveTo(x + 10, y - 128, x + 26, y - 70); ctx.lineTo(x + 20, y + 4); ctx.stroke();
			ctx.strokeStyle = "rgba(255,240,200,0.8)"; ctx.lineWidth = 1;
			for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.moveTo(x - 20 + i * 5.5, y - 8); ctx.lineTo(x - 20 + i * 5.5 + 2, y - 98 + i * 4); ctx.stroke(); }
		} else if (v === 9) { // globe on a stand
			R("#5a3a1a", -24, 8, 48, 5); R("#5a3a1a", -3, -34, 6, 44); R("#5a3a1a", -20, 4, 40, 5);
			E("#2a5a9a", 0, -62, 30, 30); ctx.fillStyle = "#4a8a4a"; ctx.beginPath(); ctx.ellipse(x - 8, y - 66, 10, 14, 0.4, 0, 6.3); ctx.ellipse(x + 12, y - 54, 8, 9, -0.3, 0, 6.3); ctx.fill();
			ctx.strokeStyle = "#c9a45f"; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y - 62, 34, 34, 0.35, 1.9, 5.6); ctx.stroke();
		} else if (v === 10) { // bookshelf
			R("#1a0f08", -46, -126, 92, 132); R("#5a3a1e", -44, -124, 88, 128);
			for (let r = 0; r < 4; r++) {
				const by = -120 + r * 30; R("#2a1a0c", -42, by + 26, 84, 4);
				for (let b = 0, bx = -40; bx < 38; b++) { const w = 5 + ((b * 7 + r * 3) % 5); ctx.fillStyle = ["#8a2a2a", "#2a4a8a", "#2a6a3a", "#c9a45f", "#6a3a7a", "#8a5a2a"][(b * 5 + r * 2) % 6]; ctx.fillRect(x + bx, y + by + 4 + ((b + r) % 3) * 2, w, 22 - ((b + r) % 3) * 2); bx += w + 1; }
			}
		} else if (v === 11) { // throne
			R("#1a0f08", -36, -124, 72, 138); R("#9a1020", -32, -120, 64, 100); R("#c9a45f", -36, -124, 72, 6); R("#c9a45f", -36, -124, 6, 112); R("#c9a45f", 30, -124, 6, 112);
			E("#c9a45f", 0, -126, 14, 8); R("#7a0c18", -38, -40, 76, 34); R("#c9a45f", -40, -42, 80, 5); R("#c9a45f", -34, -6, 8, 14); R("#c9a45f", 26, -6, 8, 14); R("#7a0c18", -28, -20, 56, 14);
		} else if (v === 12) { // upright coffin
			ctx.fillStyle = "#1a0f08"; ctx.beginPath(); ctx.moveTo(x - 16, y - 130); ctx.lineTo(x + 16, y - 130); ctx.lineTo(x + 28, y - 96); ctx.lineTo(x + 20, y + 6); ctx.lineTo(x - 20, y + 6); ctx.lineTo(x - 28, y - 96); ctx.fill();
			ctx.fillStyle = "#2c2024"; ctx.beginPath(); ctx.moveTo(x - 13, y - 124); ctx.lineTo(x + 13, y - 124); ctx.lineTo(x + 23, y - 94); ctx.lineTo(x + 16, y + 2); ctx.lineTo(x - 16, y + 2); ctx.lineTo(x - 23, y - 94); ctx.fill();
			R("#c9a45f", -3, -108, 6, 40); R("#c9a45f", -12, -96, 24, 5); R("#7a0c18", -14, -4, 28, 4);
		} else if (v === 13) { // crystal ball
			pedestal("#2a2038"); const g = 0.6 + 0.4 * Math.sin(t * 2);
			const gl = ctx.createRadialGradient(x, y - 48, 4, x, y - 48, 54); gl.addColorStop(0, `rgba(190,120,255,${0.5 * g})`); gl.addColorStop(1, "rgba(190,120,255,0)"); ctx.fillStyle = gl; ctx.fillRect(x - 56, y - 104, 112, 112);
			E("#6a3aa8", 0, -46, 20, 20); E(`rgba(220,180,255,${0.5 + 0.3 * g})`, -6, -52, 9, 9); E("rgba(255,255,255,0.7)", -8, -56, 3, 3);
		} else { // gilded mirror
			R("#1a1008", -32, -132, 64, 138); R("#c9a45f", -30, -130, 60, 134); R("#8a6a28", -26, -126, 52, 126);
			R("#b8d4e4", -22, -122, 44, 118); ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.beginPath(); ctx.moveTo(x - 10, y - 122); ctx.lineTo(x + 2, y - 122); ctx.lineTo(x - 16, y - 4); ctx.lineTo(x - 22, y - 4); ctx.fill();
			R("#c9a45f", -34, 4, 12, 6); R("#c9a45f", 22, 4, 12, 6);
		}
	}

	paintChair(ctx, x, y, v) {
		const pal = [["#8a5a2c", "#8a5a2c"], ["#b07a3c", "#c89a58"], ["#6a4220", "#b02a38"], ["#2a1a12", "#3a2a22"], ["#c9a45f", "#6a1a2a"]][v];
		ctx.fillStyle = "#1a0f08";
		ctx.fillRect(x - 15, y + 2, 5, 14); ctx.fillRect(x + 10, y + 2, 5, 14);
		ctx.fillStyle = pal[0]; ctx.fillRect(x - 14, y - 34, 28, 28); // back
		ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(x - 10, y - 30, 20, 20);
		if (v === 3) { ctx.fillStyle = pal[0]; ctx.fillRect(x - 15, y - 40, 6, 8); ctx.fillRect(x + 9, y - 40, 6, 8); }
		if (v === 4) { ctx.fillStyle = "#e8c070"; ctx.fillRect(x - 14, y - 34, 28, 3); ctx.fillRect(x - 14, y - 34, 3, 28); ctx.fillRect(x + 11, y - 34, 3, 28); }
		ctx.fillStyle = "#1a0f08"; ctx.fillRect(x - 18, y - 8, 36, 14);
		ctx.fillStyle = pal[1]; ctx.fillRect(x - 17, y - 7, 34, 11);
		ctx.fillStyle = "rgba(255,255,255,0.15)"; ctx.fillRect(x - 17, y - 7, 34, 3);
	}

	paintTableItem(ctx, x, y, v) {
		const pal = [["#8a5a2c", "#5a3418"], ["#c89a58", "#8a6a38"], ["#7a4a22", "#4a2a12"], ["#e4e0dc", "#3a3a44"], ["#2e2018", "#140c08"]][v];
		const w = [46, 40, 76, 46, 50][v], h = [30, 26, 24, 28, 28][v];
		ctx.fillStyle = "#1a0f08";
		for (const dx of [-w + 8, w - 12]) ctx.fillRect(x + dx, y - 6, 5, 20);
		ctx.fillStyle = pal[1];
		if (v === 0 || v === 3) { ctx.beginPath(); ctx.ellipse(x, y - 4, w, h, 0, 0, 6.3); ctx.fill(); ctx.fillStyle = pal[0]; ctx.beginPath(); ctx.ellipse(x, y - 12, w, h, 0, 0, 6.3); ctx.fill(); }
		else { ctx.fillRect(x - w, y - 10, w * 2, h + 2); ctx.fillStyle = pal[0]; ctx.fillRect(x - w, y - 22, w * 2, h - 2); }
		if (v === 3) { ctx.strokeStyle = "rgba(120,120,140,0.5)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 20, y - 18); ctx.lineTo(x + 6, y - 8); ctx.stroke(); }
		if (v === 2) { ctx.fillStyle = "#e8e0d0"; for (const dx of [-50, -20, 10, 40]) ctx.fillRect(x + dx, y - 20, 12, 3); }
	}

	paintSofa(ctx, x, y, v) {
		const pal = [["#9a1a2a", "#7a1020"], ["#2a6a3a", "#1e5028"], ["#2a4a8a", "#1c3466"], ["#7a4a28", "#5a3318"], ["#1c1c22", "#101014"]][v];
		ctx.fillStyle = "#1a0f08"; ctx.fillRect(x - 56, y + 4, 6, 12); ctx.fillRect(x + 50, y + 4, 6, 12);
		ctx.fillStyle = pal[1]; ctx.fillRect(x - 58, y - 40, 116, 30); // back
		ctx.fillStyle = pal[0]; ctx.fillRect(x - 54, y - 38, 108, 24);
		ctx.fillStyle = pal[1]; ctx.fillRect(x - 62, y - 22, 16, 34); ctx.fillRect(x + 46, y - 22, 16, 34); // arms
		ctx.fillStyle = pal[0]; ctx.fillRect(x - 60, y - 22, 12, 6); ctx.fillRect(x + 48, y - 22, 12, 6);
		ctx.fillStyle = pal[0]; ctx.fillRect(x - 46, y - 12, 92, 22); // seat
		ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(x - 1, y - 12, 2, 22);
		ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(x - 46, y - 12, 92, 3);
		if (v === 4) { ctx.fillStyle = "#e8c070"; ctx.fillRect(x - 62, y - 40, 124, 3); ctx.fillRect(x - 62, y - 22, 16, 3); ctx.fillRect(x + 46, y - 22, 16, 3); }
	}

	paintFireplace(ctx, x, y, v, now) {
		const pal = [["#5a5662", "#7a7480", "#14090a"], ["#8a3a2a", "#a8523a", "#14090a"], ["#e0dcd6", "#f0ece6", "#2a1a1a"]][v];
		ctx.fillStyle = "#1a0f08"; ctx.fillRect(x - 62, y - 80, 124, 96);
		ctx.fillStyle = pal[0]; ctx.fillRect(x - 60, y - 78, 120, 92);
		for (let yy = y - 78; yy < y + 14; yy += 14) for (let xx = x - 60 + (((yy - y) / 14) & 1) * 14; xx < x + 60; xx += 28) { ctx.fillStyle = pal[1]; ctx.fillRect(xx + 2, yy + 2, 24, 10); }
		ctx.fillStyle = pal[2]; ctx.fillRect(x - 34, y - 52, 68, 62);
		ctx.fillStyle = pal[1]; ctx.fillRect(x - 70, y - 86, 140, 12); // mantel
		ctx.fillStyle = "#6a3a1a"; ctx.fillRect(x - 26, y + 0, 52, 9); // logs
		const t = (now || 0) / 1000;
		for (let i = 0; i < 3; i++) {
			const f = Math.sin(t * (7 + i * 1.7) + i * 2) * 0.5 + 0.5, hgt = 18 + f * 16 + (i === 1 ? 10 : 0), fx = x - 18 + i * 18;
			ctx.fillStyle = "#e8481a"; ctx.beginPath(); ctx.moveTo(fx - 10, y); ctx.quadraticCurveTo(fx - 4, y - hgt * 0.7, fx + (f - 0.5) * 6, y - hgt); ctx.quadraticCurveTo(fx + 6, y - hgt * 0.6, fx + 10, y); ctx.fill();
			ctx.fillStyle = "#ffc03a"; ctx.beginPath(); ctx.moveTo(fx - 5, y); ctx.quadraticCurveTo(fx - 2, y - hgt * 0.45, fx + (f - 0.5) * 4, y - hgt * 0.62); ctx.quadraticCurveTo(fx + 3, y - hgt * 0.4, fx + 5, y); ctx.fill();
		}
	}
}
