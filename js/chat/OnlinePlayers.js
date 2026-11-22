// The narrow "Online" column next to the chat: the vampire names of the players who are active now.
// Asks /api/online (the same address as the "Players online" counter) every 20 seconds.
// If the server cannot be reached the list just keeps what it had.

const REFRESH_MS = 20000;

export default class OnlinePlayers {
	constructor(apiUrl, doc = document) {
		this.apiUrl = apiUrl;
		this.title = doc.getElementById("chatOnlineTitle");
		this.list = doc.getElementById("chatOnlineList");
		this.doc = doc;
	}

	start() {
		if (!this.list) return;
		this.refresh();
		setInterval(() => this.refresh(), REFRESH_MS);
	}

	async refresh() {
		try {
			const response = await fetch(this.apiUrl, { cache: "no-store" });
			const data = await response.json();
			if (!response.ok || !Array.isArray(data.names)) throw new Error("Unexpected answer");
			this.render(data.names.filter((name) => typeof name === "string"), Number.isInteger(data.online) ? data.online : data.names.length);
		} catch {
			// Keep showing the last list.
		}
	}

	render(names, online) {
		this.title.textContent = "Online (" + online + ")";
		this.list.replaceChildren();
		for (const name of names) {
			const item = this.doc.createElement("li");
			item.textContent = name; // textContent: names are never read as HTML
			this.list.appendChild(item);
		}
	}
}
