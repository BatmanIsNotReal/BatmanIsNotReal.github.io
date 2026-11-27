// The bazaar window: the four trade routes and what they earn each round.
const NAMES = { north: "North", east: "East", south: "South", west: "West" };

export default class BazaarMenu {
	// options: { getReport() -> the result of analyseTrade }
	constructor(document, options) {
		this.doc = document;
		this.o = options;
		this.modal = document.getElementById("bazaarModal");
		this.body = document.getElementById("bazaarBody");
		document.getElementById("bazaarClose").addEventListener("click", () => this.close());
		this.modal.addEventListener("click", (e) => { if (e.target === this.modal) this.close(); });
		document.addEventListener("keydown", (e) => { if (e.key === "Escape" && this.isOpen()) this.close(); });
	}

	isOpen() { return this.modal.style.display === "block"; }
	close() { this.modal.style.display = "none"; }

	open() {
		const report = this.o.getReport();
		const body = this.body;
		body.textContent = "";
		const add = (tag, text, cls) => { const n = this.doc.createElement(tag); n.textContent = text; if (cls) n.className = cls; body.append(n); return n; };
		const pct = (v) => "+" + Math.round(v * 100) + "%";
		add("p", "Roads from the bazaar to an edge of the map open a trade route. Each open route earns " + report.base + " gold every 10 seconds, plus bonuses.");
		add("p", "Huts, mines, lumber mills and the tavern among the 24 tiles around the bazaar: " + report.neighbours + " (" + pct(report.neighbourBonus) + " on every route).");
		if (report.disrepair) add("p", "The bazaar is in disrepair: it earns nothing until its upkeep is paid (wood, once a minute).", "bazaar-warning");
		const list = this.doc.createElement("ul");
		list.className = "bazaar-routes";
		for (const r of report.routes) {
			const li = this.doc.createElement("li");
			const state = !r.open ? "not connected" : r.raidedFor > 0 ? "RAIDED by highwaymen (open again in " + Math.ceil(r.raidedFor / 6 * 10) / 10 + " min)" : r.blocked ? "BLOCKED by a raiding outpost" : r.income.toFixed(1) + " gold per round";
			li.className = !r.open ? "closed" : r.blocked ? "blocked" : "open";
			const head = this.doc.createElement("b");
			head.textContent = NAMES[r.dir] + ": ";
			li.append(head, state);
			if (r.open) {
				const detail = this.doc.createElement("small");
				detail.textContent = " (" + r.length + " tiles " + pct(r.length * 0.01) + ", safety " + pct(r.safety) + (r.defences ? " from " + r.defences + (r.defences === 1 ? " defence" : " defences") : "") + ")";
				li.append(detail);
			}
			list.append(li);
		}
		body.append(list);
		add("p", "Total: " + report.income.toFixed(1) + " gold every 10 seconds.", "bazaar-total");
		add("p", "Build road tiles (they cost stone and gold) in an unbroken line from a tile next to the bazaar to the edge of the map. A watch tower, guard outpost or fort built on the road keeps it open and adds to the income. Raiding outposts within 5 tiles of a road block it. Roads cost 1 stone per tile every minute to keep up; a road tile that is not paid for cuts the route. Roads can cross grass, forest, rock (mountain road) and water (bridge).", "cave-hint");
		this.modal.style.display = "block";
	}
}
