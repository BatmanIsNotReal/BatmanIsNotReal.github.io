// "Players online: N" in the header.
// Signed-up players tell the server every 30 seconds that they are here (POST),
// and the server answers with how many players were seen in the last 90 seconds.
// Visitors who have not signed up yet only ask for the number (GET).
// Talks to /api/online in server.js. If the server cannot be reached, the line hides.

const HEARTBEAT_MS = 30000;

export default class OnlineCounter {
	// getPlayerId: returns the player's id once signed up, otherwise null
	constructor(apiUrl, getPlayerId, doc = document) {
		this.apiUrl = apiUrl;
		this.getPlayerId = getPlayerId;
		this.line = doc.getElementById("onlineLine");
	}

	start() {
		if (!this.line) return;
		setTimeout(() => this.beat(), 500); // after main.js has read the save, so we know if the player is signed up
		setInterval(() => this.beat(), HEARTBEAT_MS);
	}

	async beat() {
		try {
			const id = this.getPlayerId();
			const response = await fetch(this.apiUrl, id
				? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }
				: { cache: "no-store" });
			const data = await response.json();
			if (!response.ok || !Number.isInteger(data.online)) throw new Error("Unexpected answer");
			this.line.textContent = "Players online: " + data.online;
			this.line.hidden = false;
		} catch {
			this.line.hidden = true; // server not reachable
		}
	}
}
