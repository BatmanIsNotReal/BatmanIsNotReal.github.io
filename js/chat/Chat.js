// Chat panel: shows messages from the chat server and sends new ones.
// Talks to the API in server.js:  GET /api/chat?after=<id>   and   POST /api/chat

import { makeProfileLink } from "../profile/profileLink.js";

// GIFs: a message with a direct link to a picture from one of these sites shows the
// picture. Only these sites are allowed, so a link cannot make everyone's browser
// contact some random server.
const GIF_HOSTS = ["media.giphy.com", "i.giphy.com", "media0.giphy.com", "media1.giphy.com", "media2.giphy.com",
	"media3.giphy.com", "media4.giphy.com", "media.tenor.com", "c.tenor.com", "i.imgur.com"];

function findGifUrl(text) {
	for (const match of text.matchAll(/https:\/\/[^\s<>"]+/gi)) {
		try {
			const url = new URL(match[0]);
			if (GIF_HOSTS.includes(url.hostname) && /\.(gif|webp)$/i.test(url.pathname)) {
				return { link: match[0], url: url.href };
			}
		} catch { /* not a valid address: just text */ }
	}
	return null;
}

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
		this.recentMessages = [];   // the last few, for the underground's chat box
		this.listeners = new Set(); // functions called with every batch of new messages

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
		if (this.nameInput.readOnly) return;
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

	// Use the player's vampire name in the chat and stop it being edited.
	lockName(name) {
		this.nameInput.value = name;
		this.nameInput.readOnly = true;
		this.nameInput.title = "Your chat name is your vampire name";
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
			this.log.appendChild(this.buildMessage(message, message.name === myName, nearBottom));
		}

		this.recentMessages.push(...fresh);
		if (this.recentMessages.length > 30) this.recentMessages.splice(0, this.recentMessages.length - 30);
		for (const listener of this.listeners) { try { listener(fresh); } catch { /* a broken listener must not stop the chat */ } }

		while (this.log.children.length > MAX_MESSAGES_ON_SCREEN) {
			this.log.removeChild(this.log.firstChild);
		}
		if (nearBottom) this.log.scrollTop = this.log.scrollHeight;
	}

	buildMessage(message, isMine, keepAtBottom = false) {
		// textContent (never innerHTML) so nobody can inject HTML into the page.
		const row = document.createElement("div");
		row.className = isMine ? "chat-message own" : "chat-message";
		if (String(message.text).startsWith("LEVEL UP!")) row.classList.add("chat-levelup");
		// Big dice wins are announced by the server. Players cannot use this name (the server refuses it).
		if (message.name === "Dice Master") row.classList.add("chat-dice");
		if (message.name === "Town Crier") row.classList.add("chat-dice");

		const time = document.createElement("span");
		time.className = "chat-time";
		time.textContent = new Date(message.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

		// Players' names open their character page; the Dice Master and Town Crier are not players
		const isPlayer = message.name !== "Dice Master" && message.name !== "Town Crier";
		const name = document.createElement(isPlayer ? "a" : "span");
		name.className = isPlayer ? "chat-name player-link" : "chat-name";
		if (isPlayer) makeProfileLink(name, String(message.name));
		name.textContent = String(message.name);

		const gif = findGifUrl(String(message.text));
		const text = document.createElement("span");
		text.className = "chat-text";
		// the link itself is replaced by the picture
		text.textContent = gif ? String(message.text).replace(gif.link, "").trim() : String(message.text);

		row.append(time, name);
		if (text.textContent) row.append(text);

		if (gif) {
			const picture = document.createElement("img");
			picture.className = "chat-gif";
			picture.src = gif.url;
			picture.alt = "GIF";
			picture.loading = "lazy";
			picture.referrerPolicy = "no-referrer";
			// A picture changes the height of the chat: stay at the bottom if we were there
			picture.addEventListener("load", () => {
				if (keepAtBottom) this.log.scrollTop = this.log.scrollHeight;
			});
			// If the picture cannot be loaded, show the link as text instead
			picture.addEventListener("error", () => {
				const fallback = document.createElement("span");
				fallback.className = "chat-text";
				fallback.textContent = gif.link;
				picture.replaceWith(fallback);
			});
			row.appendChild(picture);
		}
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
	// textOverride: send this text instead of what is typed in the box (used by the GIF picker)
	async send(textOverride) {
		const fromPicker = typeof textOverride === "string";
		const text = fromPicker ? textOverride.trim() : this.messageInput.value.trim();
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

			if (!fromPicker) this.messageInput.value = "";
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

	// For other parts of the game (the underground) that show the same chat: subscribe(fn) calls fn(messages)
	// for every new batch and returns a function that stops it.
	subscribe(listener) {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	// Sends a message typed somewhere else. Resolves to { ok: true } or { ok: false, error }.
	async post(text) {
		text = String(text).trim();
		if (!text) return { ok: false, error: "" };
		this.saveName();
		try {
			const response = await fetch(this.apiUrl, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: this.nameInput.value, text }),
			});
			const data = await response.json().catch(() => ({}));
			if (!response.ok) return { ok: false, error: data.error || "Could not send your message." };
			this.addMessages([data.message]);
			return { ok: true };
		} catch {
			return { ok: false, error: "Could not reach the chat server." };
		}
	}

	// Posts a message for the player without touching the input box or the status line
	// (used for the level-up announcements). Failing is fine: it is only an announcement.
	async announce(text, name) {
		try {
			const response = await fetch(this.apiUrl, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name, text: String(text).slice(0, 300) }),
			});
			const data = await response.json().catch(() => ({}));
			if (response.ok && data.message) this.addMessages([data.message]);
		} catch {
			// chat server not reachable: skip
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
