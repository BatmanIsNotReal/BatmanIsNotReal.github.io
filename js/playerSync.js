// Sends the player's names and main stats to the server, which keeps them in
// server-data/players.json (see /api/player in server.js).
// The game itself is still saved in the browser; this is the extra copy in a file.
// If the server cannot be reached, nothing happens and the game carries on.

const ID_KEY = "vampirePlayerId";

function randomId() {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export default class PlayerSync {
	constructor(apiUrl) {
		this.apiUrl = apiUrl;
		this.id = this.loadId();
		this.lastSent = "";
		this.warned = false;
	}

	// Every browser gets a random id once, so the server can tell players apart
	// without accounts or passwords.
	loadId() {
		try {
			const saved = localStorage.getItem(ID_KEY);
			if (saved && /^[a-f0-9]{32}$/.test(saved)) return saved;
		} catch {
			// localStorage blocked: use an id that lasts until the page is closed.
		}
		const id = randomId();
		try {
			localStorage.setItem(ID_KEY, id);
		} catch {
			// Nothing to do.
		}
		return id;
	}

	// profile: { vampireName, settlementName, level, stats: { blood, humanFood, wood, iron, bronze, gold, familiars, influence } }
	//
	// Always answers with an object, never throws:
	//   { ok: true }                      saved (or nothing had changed)
	//   { ok: false, status, error }      the server said no (409 = that vampire name is taken)
	//   { ok: false, offline: true }      the server could not be reached
	async save(profile) {
		const body = JSON.stringify({ id: this.id, ...profile });
		if (body === this.lastSent) return { ok: true }; // nothing changed since the last save

		try {
			const response = await fetch(this.apiUrl, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body,
			});
			if (response.ok) {
				this.lastSent = body;
				this.warned = false;
				return { ok: true };
			}
			const data = await response.json().catch(() => ({}));
			return { ok: false, status: response.status, error: data.error || "" };
		} catch (error) {
			if (!this.warned) console.warn("Could not reach the server to save the player file:", error.message);
			this.warned = true;
			return { ok: false, offline: true };
		}
	}
}
