// Chat panel: shows messages from the chat server and sends new ones.
// Talks to the API in server.js:  GET /api/chat?after=<id>   and   POST /api/chat

const NAME_STORAGE_KEY = "vampireChatName";
const MAX_MESSAGES_ON_SCREEN = 200;
const POLL_VISIBLE_MS = 2500;
const POLL_HIDDEN_MS = 15000;
const POLL_MAX_BACKOFF_MS = 30000;

export default class Chat {
	constructor(apiUrl, doc = document) {
		this.apiUrl = apiUrl;
		this.log = doc.getElementById("chatLog");
		this.form = doc.getElementById("chatForm");
		this.nameInput = doc.getElementById("chatName");
		this.messageInput = doc.getElementById("chatInput");
		this.sendButton = doc.getElementById("chatSend");
		this.statusLine = doc.getElementById("chatStatus");

		this.lastId = 0;
		this.failures = 0;
		this.online = null; // unknown until the first answer
		this.sending = false;
		this.pollTimer = null;
		this.statusTimer = null;
		this.seenIds = new Set();
		this.emptyNote = null;

		this.nameInput.value = this.loadName();
	}

	start() {
		this.showEmptyNote("Connecting to the chat…");
		this.form.addEventListener("submit", (event) => {
			event.preventDefault();
			this.send();
		});
		this.nameInput.addEventListener("change", () => this.saveName());
		document.addEventListener("visibilitychange", () => {
			// Check right away when the player comes back to the tab.
			if (!document.hidden) this.pollNow();
		});
		this.poll();
	}

	// ---------- Name ----------
	loadName() {
		try {
			const saved = localStorage.getItem(NAME_STORAGE_KEY);
			if (saved) return saved;
		} catch {
			// localStorage can be blocked; fall through to a random name.
		}
		return "Vampire" + Math.floor(1000 + Math.random() * 9000);
	}

	saveName() {
		const name = this.nameInput.value.replace(/\s+/g, " ").trim();
		if (!name) {
			this.nameInput.value = this.loadName();
			return;
		}
		this.nameInput.value = name;
		try {
			localStorage.setItem(NAME_STORAGE_KEY, name);
		} catch {
			// Not being able to remember the name is fine.
		}
	}

	// ---------- Receiving ----------
	async poll() {
		clearTimeout(this.pollTimer);
		try {
			const response = await fetch(`${this.apiUrl}?after=${this.lastId}`, { cache: "no-store" });
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const data = await response.json(); // throws if the server answered with a web page instead
			if (!Array.isArray(data.messages)) throw new Error("Unexpected answer");

			this.failures = 0;
			this.setOnline(true);
			this.addMessages(data.messages);
			if (Number.isInteger(data.lastId) && data.lastId < this.lastId) {
				// The server was reset: start over from its beginning.
				this.lastId = 0;
				this.seenIds.clear();
				this.log.replaceChildren();
			}
		} catch {
			this.failures++;
			this.setOnline(false);
		}
		this.pollTimer = setTimeout(() => this.poll(), this.nextDelay());
	}

	pollNow() {
		clearTimeout(this.pollTimer);
		this.poll();
	}

	nextDelay() {
		if (this.failures > 0) {
			return Math.min(POLL_MAX_BACKOFF_MS, 3000 * 2 ** (this.failures - 1));
		}
		return document.hidden ? POLL_HIDDEN_MS : POLL_VISIBLE_MS;
	}

	setOnline(online) {
		if (this.online === online) return;
		this.online = online;
		if (online) {
			this.setStatus("");
			if (this.log.children.length === 0 || this.emptyNote) {
				this.showEmptyNote("No messages yet. Say hello!");
			}
		} else {
			this.setStatus("Chat server not reachable. Trying again…", true);
			if (this.log.children.length === 0 || this.emptyNote) {
				this.showEmptyNote("The chat server is offline. Start the game with “node server.js” to chat.");
			}
		}
		this.sendButton.disabled = !online;
	}

	// ---------- Showing messages ----------
	addMessages(list) {
		const fresh = list.filter((m) => m && Number.isInteger(m.id) && !this.seenIds.has(m.id));
		if (fresh.length === 0) return;

		const nearBottom = this.log.scrollHeight - this.log.scrollTop - this.log.clientHeight < 40;
		this.clearEmptyNote();

		const myName = this.nameInput.value;
		for (const message of fresh) {
			this.seenIds.add(message.id);
			this.lastId = Math.max(this.lastId, message.id);
			this.log.appendChild(this.buildMessage(message, message.name === myName));
		}

		while (this.log.children.length > MAX_MESSAGES_ON_SCREEN) {
			this.log.removeChild(this.log.firstChild);
		}
		if (nearBottom) this.log.scrollTop = this.log.scrollHeight;
	}

	buildMessage(message, isMine) {
		// textContent (never innerHTML) so nobody can inject HTML into the page.
		const row = document.createElement("div");
		row.className = isMine ? "chat-message own" : "chat-message";

		const time = document.createElement("span");
		time.className = "chat-time";
		time.textContent = new Date(message.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

		const name = document.createElement("span");
		name.className = "chat-name";
		name.textContent = String(message.name);

		const text = document.createElement("span");
		text.className = "chat-text";
		text.textContent = String(message.text);

		row.append(time, name, text);
		return row;
	}

	showEmptyNote(text) {
		if (!this.emptyNote) {
			this.emptyNote = document.createElement("p");
			this.emptyNote.className = "chat-empty";
			this.log.appendChild(this.emptyNote);
		}
		this.emptyNote.textContent = text;
	}

	clearEmptyNote() {
		if (this.emptyNote) {
			this.emptyNote.remove();
			this.emptyNote = null;
		}
	}

	// ---------- Sending ----------
	async send() {
		const text = this.messageInput.value.trim();
		if (!text || this.sending) return;
		this.saveName();

		this.sending = true;
		this.sendButton.disabled = true;
		try {
			const response = await fetch(this.apiUrl, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: this.nameInput.value, text }),
			});
			const data = await response.json().catch(() => ({}));
			if (!response.ok) throw new Error(data.error || "Could not send your message.");

			this.messageInput.value = "";
			this.addMessages([data.message]);
			this.log.scrollTop = this.log.scrollHeight;
			this.setOnline(true);
		} catch (error) {
			const offline = error instanceof TypeError; // fetch itself failed
			this.setStatus(offline ? "Could not reach the chat server." : error.message, true, 5000);
		} finally {
			this.sending = false;
			this.sendButton.disabled = this.online === false;
			this.messageInput.focus();
		}
	}

	setStatus(text, isError = false, clearAfterMs = 0) {
		clearTimeout(this.statusTimer);
		this.statusLine.textContent = text;
		this.statusLine.classList.toggle("error", isError);
		if (clearAfterMs) {
			this.statusTimer = setTimeout(() => {
				// Go back to the connection status if the server is still down.
				if (this.online === false) this.setStatus("Chat server not reachable. Trying again…", true);
				else this.setStatus("");
			}, clearAfterMs);
		}
	}
}
