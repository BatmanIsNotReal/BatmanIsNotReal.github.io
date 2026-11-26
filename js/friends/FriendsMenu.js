// The friend list: friends (with who is online), requests you got, requests you sent, and a box to ask somebody by name.
// The lists live on the server (server.js, /api/friends) so a friend sees you too.
const POLL_MS = 30000;

export default class FriendsMenu {
	// options: { apiUrl, getPlayerId(), openDice(name), openPage(name), onBadge(count) }
	constructor(document, options) {
		this.doc = document;
		this.o = options;
		this.modal = document.getElementById("friendsModal");
		this.button = document.getElementById("friendsButton");
		this.body = document.getElementById("friendsBody");
		this.status = document.getElementById("friendsStatus");
		this.nameInput = document.getElementById("friendsName");
		this.addButton = document.getElementById("friendsAdd");
		this.data = { friends: [], incoming: [], outgoing: [] };
	}

	start() {
		if (!this.modal) return;
		if (this.button) this.button.addEventListener("click", () => this.open());
		document.getElementById("friendsClose").addEventListener("click", () => this.close());
		this.modal.addEventListener("click", (e) => { if (e.target === this.modal) this.close(); });
		document.addEventListener("keydown", (e) => { if (e.key === "Escape" && this.isOpen()) this.close(); });
		this.addButton.addEventListener("click", () => this.request(this.nameInput.value.trim()).then((r) => { if (r.ok) this.nameInput.value = ""; }));
		this.nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") this.addButton.click(); });
		setTimeout(() => this.refresh(), 4000);
		setInterval(() => { if (!document.hidden) this.refresh(); }, POLL_MS);
	}

	isOpen() { return this.modal.style.display === "block"; }
	open() { this.modal.style.display = "block"; this.setStatus(""); this.refresh(); }
	close() { this.modal.style.display = "none"; }
	setStatus(text, bad = false) { this.status.textContent = text; this.status.className = "friends-status" + (bad ? " bad" : ""); }

	async call(action, name) {
		const id = this.o.getPlayerId();
		if (!id) return { ok: false, error: "Name your vampire first." };
		try {
			const response = await fetch(this.o.apiUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action, name }) });
			const data = await response.json();
			if (!response.ok) return { ok: false, error: data.error || "Something went wrong." };
			if (Array.isArray(data.friends)) { this.data = data; this.render(); }
			return { ok: true, message: data.message || "" };
		} catch {
			return { ok: false, error: "The server cannot be reached." };
		}
	}

	refresh() { return this.call("list"); }

	// Used by the tavern's "Add friend" and by the box in the window
	async request(name) {
		if (!name) { this.setStatus("Type a player's name.", true); return { ok: false, error: "Type a player's name." }; }
		const result = await this.call("request", name);
		if (this.isOpen()) this.setStatus(result.ok ? result.message : result.error, !result.ok);
		return result;
	}

	async act(action, name) {
		const result = await this.call(action, name);
		this.setStatus(result.ok ? result.message : result.error, !result.ok);
	}

	render() {
		const { friends, incoming, outgoing } = this.data;
		if (this.o.onBadge) this.o.onBadge(incoming.length);
		const body = this.body;
		body.textContent = "";
		const el = (tag, cls, text) => { const n = this.doc.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
		const small = (label, handler) => { const b = el("button", "button friends-small", label); b.type = "button"; b.addEventListener("click", handler); return b; };
		const section = (title, rows, build) => {
			body.append(el("h4", "", title));
			if (!rows.length) { body.append(el("p", "friends-empty", "Nobody yet.")); return; }
			const ul = el("ul", "friends-list");
			for (const row of rows) { const li = el("li"); build(li, row); ul.append(li); }
			body.append(ul);
		};
		if (incoming.length) section("Wants to be your friend", incoming, (li, r) => {
			li.append(el("span", "friends-name", r.name), small("Accept", () => this.act("accept", r.name)), small("Decline", () => this.act("decline", r.name)));
		});
		section("Friends (" + friends.length + ")", [...friends].sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name)), (li, r) => {
			const dot = el("i", "friends-dot" + (r.online ? " on" : ""));
			dot.title = r.online ? "online" : "offline";
			li.append(dot, el("span", "friends-name", r.name + " (level " + r.level + ")"),
				small("Dice", () => { this.close(); this.o.openDice(r.name); }),
				small("Page", () => this.o.openPage(r.name)),
				small("Remove", () => { if (confirm("Remove " + r.name + " from your friends?")) this.act("remove", r.name); }));
		});
		if (outgoing.length) section("Asked, waiting for an answer", outgoing, (li, r) => {
			li.append(el("span", "friends-name", r.name), small("Take back", () => this.act("cancel", r.name)));
		});
	}
}
