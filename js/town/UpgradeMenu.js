// The "Upgrade" pop-up that opens when you click one of your buildings.
// The same code runs in the game window and in the map window (map.html); both have the same
// markup (#upgradeModal ...) and give this class two functions:
//   getInfo(tileId)  -> what Town.upgradeInfo() returns (or null)
//   upgrade(tileId)  -> { ok, message }; does the buying
//   demolishInfo(tileId) / demolish(tileId)  (optional) -> what Town.demolishInfo() returns / { ok, message }
import formatNumber from "../formatNumber.js";

export default class UpgradeMenu {
	constructor(doc, { getInfo, upgrade, onUpgraded = () => {}, demolishInfo = null, demolish = null, onDemolished = () => {} }) {
		this.doc = doc;
		this.getInfo = getInfo;
		this.upgrade = upgrade;
		this.onUpgraded = onUpgraded;
		this.demolishInfo = demolishInfo;
		this.demolish = demolish;
		this.onDemolished = onDemolished;
		this.confirming = false; // the demolish button needs a second click
		this.demolishButton = doc.getElementById("demolishButton");
		this.demolishNote = doc.getElementById("demolishNote");
		this.tileId = null;
		this.modal = doc.getElementById("upgradeModal");
		this.title = doc.getElementById("upgradeTitle");
		this.now = doc.getElementById("upgradeNow");
		this.next = doc.getElementById("upgradeNext");
		this.costs = doc.getElementById("upgradeCosts");
		this.button = doc.getElementById("upgradeButton");
		this.message = doc.getElementById("upgradeMessage");
		this.next.hidden = false;
		// what the building earns and costs (filled in by render)
		this.economy = doc.createElement("div");
		this.economy.className = "upgrade-economy";
		this.now.insertAdjacentElement("afterend", this.economy);

		doc.getElementById("upgradeClose").addEventListener("click", () => this.close());
		this.modal.addEventListener("click", (event) => { if (event.target === this.modal) this.close(); });
		doc.addEventListener("keydown", (event) => { if (event.key === "Escape") this.close(); });
		if (this.demolishButton && this.demolish) {
			this.demolishButton.addEventListener("click", () => {
				const info = this.demolishInfo(this.tileId);
				if (!info || info.blocked) return this.render();
				if (!this.confirming) {
					this.confirming = true;
					return this.render();
				}
				this.confirming = false;
				const result = this.demolish(this.tileId);
				if (result.ok) {
					this.close();
					this.onDemolished(result.message);
				} else {
					this.render(result.message, false);
				}
			});
		}
		this.button.addEventListener("click", () => {
			const result = this.upgrade(this.tileId);
			this.render(result.message, result.ok);
			if (result.ok) this.onUpgraded();
		});
	}

	open(tileId) {
		this.tileId = tileId;
		this.confirming = false;
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
		this.economy.replaceChildren();
		const line = (label, text, cls) => { const p = this.doc.createElement("p"); const b = this.doc.createElement("b"); b.textContent = label + " "; p.append(b, text); if (cls) p.className = cls; this.economy.append(p); };
		if (info.income && info.income.length) line("Income (per minute):", info.income.join(", "));
		else if (info.income) line("Income:", "none");
		line("Upkeep:", info.upkeep || "none", info.neglected ? "price-short" : "");
		if (info.neglected) line("In disrepair:", "not producing until the upkeep is paid.", "price-short");
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
		this.renderDemolish();
		if (message !== null) {
			this.message.textContent = message;
			this.message.className = good ? "upgrade-good" : "upgrade-bad";
		}
	}

	// The demolish button and what it would do. The first click asks "are you sure?", the second does it.
	renderDemolish() {
		if (!this.demolishButton || !this.demolish) return;
		const info = this.demolishInfo(this.tileId);
		if (!info) return;
		const back = info.refunds.map((refund) => formatNumber(refund.amount) + " " + refund.label).join(", ");
		this.demolishButton.disabled = Boolean(info.blocked);
		this.demolishButton.textContent = this.confirming ? "Yes, demolish it" : "Demolish";
		this.demolishButton.classList.toggle("demolish-confirm", this.confirming);
		if (info.blocked) {
			this.demolishNote.textContent = info.blocked;
		} else if (this.confirming) {
			this.demolishNote.textContent = "Level " + info.level + " is lost and not refunded. You get back " + (back || "nothing") + ". Click again to confirm.";
		} else {
			this.demolishNote.textContent = "Gives back 70% of the building price: " + (back || "nothing") + ".";
		}
	}
}
