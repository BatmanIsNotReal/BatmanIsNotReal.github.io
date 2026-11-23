// The "Upgrade" pop-up that opens when you click one of your buildings.
// The same code runs in the game window and in the map window (map.html); both have the same
// markup (#upgradeModal ...) and give this class two functions:
//   getInfo(tileId)  -> what Town.upgradeInfo() returns (or null)
//   upgrade(tileId)  -> { ok, message }; does the buying
import formatNumber from "../formatNumber.js";

export default class UpgradeMenu {
	constructor(doc, { getInfo, upgrade, onUpgraded = () => {} }) {
		this.doc = doc;
		this.getInfo = getInfo;
		this.upgrade = upgrade;
		this.onUpgraded = onUpgraded;
		this.tileId = null;
		this.modal = doc.getElementById("upgradeModal");
		this.title = doc.getElementById("upgradeTitle");
		this.now = doc.getElementById("upgradeNow");
		this.next = doc.getElementById("upgradeNext");
		this.costs = doc.getElementById("upgradeCosts");
		this.button = doc.getElementById("upgradeButton");
		this.message = doc.getElementById("upgradeMessage");
		this.next.hidden = false;

		doc.getElementById("upgradeClose").addEventListener("click", () => this.close());
		this.modal.addEventListener("click", (event) => { if (event.target === this.modal) this.close(); });
		doc.addEventListener("keydown", (event) => { if (event.key === "Escape") this.close(); });
		this.button.addEventListener("click", () => {
			const result = this.upgrade(this.tileId);
			this.render(result.message, result.ok);
			if (result.ok) this.onUpgraded();
		});
	}

	open(tileId) {
		this.tileId = tileId;
		this.render("");
		this.modal.style.display = "block";
	}

	close() {
		this.modal.style.display = "none";
	}

	isOpen() {
		return this.modal.style.display === "block";
	}

	// Draws the menu from the current state (also called every second while it is open)
	render(message = null, good = false) {
		const info = this.tileId ? this.getInfo(this.tileId) : null;
		if (!info) { this.close(); return; }

		this.title.textContent = info.name + " - level " + info.level + " of " + info.max;
		this.now.textContent = "Now: " + info.now;
		this.costs.replaceChildren();
		if (info.atMax) {
			this.next.textContent = "Fully upgraded.";
			this.button.hidden = true;
		} else {
			this.next.textContent = "Next level: " + info.next;
			this.button.hidden = false;
			this.button.disabled = !info.canAfford;
			for (const cost of info.costs) {
				const item = this.doc.createElement("li");
				item.textContent = cost.label + ": " + formatNumber(cost.need) + " (you have " + formatNumber(cost.have) + ")";
				item.title = cost.need.toLocaleString("en-US") + " needed, " + Math.floor(cost.have).toLocaleString("en-US") + " owned";
				if (cost.short) item.className = "price-short";
				this.costs.appendChild(item);
			}
		}
		if (message !== null) {
			this.message.textContent = message;
			this.message.className = good ? "upgrade-good" : "upgrade-bad";
		}
	}
}
