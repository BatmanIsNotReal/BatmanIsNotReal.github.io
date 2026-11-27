// The windows of the war: click a defence building, an enemy outpost or a building held by the enemy
// on the map; plus the battle report that opens after a raid.
import { TILE, FACTIONS, FORT_RADIUS, guardCancelChance, guardPenalty, warnLead } from "./rules.mjs";

const SHARES = [[0.25, "Send a quarter"], [0.5, "Send half"], [0.75, "Send three quarters"], [1, "Send everything"]];

export default class WarMenu {
	// options: { war, town, inventory, familiars, updateBox, onChange() }
	constructor(document, options) {
		this.document = document;
		this.options = options;
		this.modal = document.getElementById("warModal");
		this.title = document.getElementById("warTitle");
		this.body = document.getElementById("warBody");
		this.actions = document.getElementById("warActions");
		document.getElementById("warClose").addEventListener("click", () => this.close());
		this.modal.addEventListener("click", (e) => { if (e.target === this.modal) this.close(); });
		document.addEventListener("keydown", (e) => { if (e.key === "Escape" && this.isOpen()) this.close(); });
		this.current = null;
	}

	isOpen() { return this.modal.style.display === "block"; }
	close() { this.modal.style.display = "none"; this.current = null; }

	clear(title) {
		this.title.textContent = title;
		this.body.textContent = "";
		this.actions.textContent = "";
		this.modal.style.display = "block";
	}

	line(text, className = "") {
		const p = this.document.createElement("p");
		p.textContent = text;
		if (className) p.className = className;
		this.body.appendChild(p);
		return p;
	}

	button(label, handler, disabled = false, hint = "") {
		const b = this.document.createElement("button");
		b.type = "button";
		b.className = "button";
		b.textContent = label;
		b.disabled = disabled;
		if (hint) b.title = hint;
		b.addEventListener("click", handler);
		this.actions.appendChild(b);
		return b;
	}

	closeButton() { this.button("Close", () => this.close()); }

	showReport(title, lines) {
		this.current = null;
		this.clear(title);
		for (const text of lines) this.line(text);
		this.closeButton();
	}

	open(tileId) {
		const { war, town } = this.options;
		const type = town.tiles[tileId];
		this.current = tileId;
		if (type === TILE.OUTPOST) return this.openOutpost(tileId);
		if (type === TILE.HELD) return this.openHeld(tileId);
		return this.openDefence(tileId);
	}

	refresh() {
		if (this.current && this.isOpen()) this.open(this.current);
	}

	// ----- defence buildings -----
	openDefence(id) {
		const { war, town, inventory, familiars, updateBox } = this.options;
		const info = war.defenceInfo(id);
		if (!info) return this.close();
		this.clear(info.name);
		this.line(town.Buildings[info.key].description.replace(/^./, (c) => c.toUpperCase()) + ".");
		if (info.type === TILE.WATCH_TOWER) {
			this.line(`You have ${info.towers} watch tower${info.towers === 1 ? "" : "s"}: raids are announced ${warnLead(info.towers) * 10} seconds before they arrive, with the raiders' exact strength. More towers give more warning.`);
		} else if (info.type === TILE.GUARD_OUTPOST) {
			this.line(`You have ${info.guards} guard outpost${info.guards === 1 ? "" : "s"}: ${Math.round(guardCancelChance(info.guards) * 100)}% of raids are turned back before they set out, and the raiders who do come are ${Math.round((1 - guardPenalty(info.guards)) * 100)}% weaker.`);
		} else {
			this.line(`It protects every building within ${FORT_RADIUS} tiles. A raid has to beat the army and the garrison; even then it only breaks the fort's walls first. A fort that is worn down completely falls.`);
		}
		this.line(`Garrison: power ${Math.round(info.garrison).toLocaleString("en-US")} of ${Math.round(info.full).toLocaleString("en-US")} (it grows as you level up).` + (info.damage > 0.01 ? ` Damaged: ${Math.round(info.damage * 100)}%, it heals slowly.` : ""));
		const demolish = town.demolishInfo(id, familiars);
		this.button("Demolish", () => {
			this.line("Really demolish it? You get back " + demolish.refunds.map((r) => r.amount.toLocaleString("en-US") + " " + r.label).join(", ") + ". Press Demolish again to confirm.", "demolish-note");
			this.actions.textContent = "";
			this.button("Demolish for real", () => {
				const result = town.demolishTile(id, inventory, familiars, updateBox, this.document);
				this.options.onChange();
				this.showReport(result.ok ? "Demolished" : "Cannot demolish", [result.message]);
			});
			this.closeButton();
		}, !!demolish.blocked, demolish.blocked || "");
		this.closeButton();
	}

	// ----- attacks -----
	attackButtons(sendPower, enemyPower, act) {
		const army = this.options.war.armyPower();
		for (const [share, label] of SHARES) {
			const ratio = (army * share) / Math.max(1, enemyPower);
			const odds = ratio >= 1.6 ? "good odds" : ratio >= 0.85 ? "an even fight" : "poor odds";
			this.button(`${label} (${odds})`, () => act(share), army <= 0, `Power ${Math.round(army * share).toLocaleString("en-US")}`);
		}
	}

	showResult(result) {
		this.current = null;
		this.clear(result.won ? "Victory" : result.ok ? "Defeat" : "Cannot attack");
		for (const text of result.lines) this.line(text);
		this.closeButton();
		this.options.onChange();
	}

	openOutpost(id) {
		const { war } = this.options;
		const info = war.outpostInfo(id);
		if (!info) return this.close();
		this.clear(info.label[0].toUpperCase() + info.label.slice(1));
		this.line(`${info.what[0].toUpperCase() + info.what.slice(1)} (${info.name}) camps here. This camp ${info.goal}.`);
		if (info.captives > 0) this.line(`Held captive here: ${info.captives.toLocaleString("en-US")} of your familiars. Destroying the camp frees them.`);
		const loot = Object.entries(info.stolen).filter(([, v]) => v > 0).map(([k, v]) => v.toLocaleString("en-US") + " " + k);
		if (loot.length) this.line(`Stolen from you and stored here: ${loot.join(", ")}. You get it back when the camp falls.`);
		this.line(`Defenders: strength ${info.text}${war.towers() > 0 ? "" : " (build a watch tower to see exactly)"}.`);
		this.line(`Raids sent so far: ${info.raids}.` + (info.raiding ? " A raiding party is out on the march right now, so the camp is weaker." : ""));
		this.line(`Your army: power ${Math.round(war.armyPower()).toLocaleString("en-US")} (${war.armyCount().toLocaleString("en-US")} vampires). Some of your vampires will die in the fight. Destroying the outpost stops its raids and frees buildings it holds.`);
		this.attackButtons(war.armyPower(), info.strength * 1.25, (share) => this.showResult(war.attackOutpost(id, share)));
		this.closeButton();
	}

	openHeld(id) {
		const { war } = this.options;
		const info = war.heldInfo(id);
		if (!info) return this.close();
		this.clear(`Your ${info.name.toLowerCase()} is held by raiders`);
		this.line(`It does nothing while the enemy holds it. Raiders stationed here: strength ${info.text}. Destroying their outpost frees it as well.`);
		this.line(`Your army: power ${Math.round(war.armyPower()).toLocaleString("en-US")}.`);
		this.attackButtons(war.armyPower(), info.garrison, (share) => this.showResult(war.retake(id, share)));
		this.closeButton();
	}
}
