// Leaderboard pop-up: shows the best players saved on the server.
// Talks to GET /api/leaderboard in server.js.

export default class Leaderboard {
	// getMyName: function that returns the current player's vampire name (to highlight their row)
	constructor(apiUrl, getMyName, doc = document) {
		this.apiUrl = apiUrl;
		this.getMyName = getMyName;
		this.openButton = doc.getElementById("leaderboardButton");
		this.modal = doc.getElementById("leaderboardModal");
		this.closeButton = doc.getElementById("leaderboardClose");
		this.refreshButton = doc.getElementById("leaderboardRefresh");
		this.statusLine = doc.getElementById("leaderboardStatus");
		this.tableBody = doc.getElementById("leaderboardBody");
		this.scroll = doc.getElementById("leaderboardScroll");
		this.loadCount = 0; // so a slow, old answer cannot replace a newer one
	}

	start() {
		this.openButton.addEventListener("click", () => this.open());
		this.closeButton.addEventListener("click", () => this.close());
		this.closeButton.addEventListener("keydown", (event) => {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				this.close();
			}
		});
		this.refreshButton.addEventListener("click", () => this.load());
		this.modal.addEventListener("click", (event) => {
			if (event.target === this.modal) this.close(); // click on the dark background
		});
		document.addEventListener("keydown", (event) => {
			if (event.key === "Escape" && this.isOpen()) this.close();
		});
	}

	isOpen() {
		return this.modal.style.display === "block";
	}

	open() {
		this.modal.style.display = "block";
		this.closeButton.focus();
		this.load();
	}

	close() {
		this.modal.style.display = "none";
		this.openButton.focus();
	}

	async load() {
		const thisLoad = ++this.loadCount;
		this.setStatus("Loading…");
		this.refreshButton.disabled = true;
		try {
			const response = await fetch(this.apiUrl, { cache: "no-store" });
			const data = await response.json().catch(() => ({}));
			if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
			if (!Array.isArray(data.players)) throw new Error("Unexpected answer");
			if (thisLoad !== this.loadCount) return;

			this.render(data.players);
			this.setStatus(data.players.length === 0 ? "No players on the leaderboard yet." : "");
		} catch (error) {
			if (thisLoad !== this.loadCount) return;
			this.render([]);
			const unreachable = error instanceof TypeError || /^HTTP 404/.test(error.message);
			this.setStatus(unreachable
				? "The leaderboard is not available right now (the game server cannot be reached)."
				: error.message);
		} finally {
			if (thisLoad === this.loadCount) this.refreshButton.disabled = false;
		}
	}

	render(players) {
		const me = String(this.getMyName() || "").trim().toLowerCase();
		const rows = players.map((player) => {
			const row = document.createElement("tr");
			if (me && String(player.vampireName).toLowerCase() === me) row.className = "me";
			if (player.rank <= 3) row.classList.add("top" + player.rank);

			// textContent (never innerHTML): names are typed by players.
			const cells = [
				player.rank,
				player.vampireName,
				player.settlementName,
				player.level,
				Math.floor(player.influence),
				Math.floor(player.blood),
				Math.floor(player.familiars),
			];
			cells.forEach((value, index) => {
				const cell = document.createElement("td");
				cell.textContent = String(value);
				if (index >= 3) cell.className = "number";
				row.appendChild(cell);
			});
			return row;
		});
		this.tableBody.replaceChildren(...rows);
		this.scroll.hidden = rows.length === 0;
	}

	setStatus(text) {
		this.statusLine.textContent = text;
	}
}
