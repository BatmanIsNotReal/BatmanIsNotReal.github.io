// The window where level points are spent on Health, Defence, Strength and Magic.
// It opens by itself on every level-up, and from the "Attributes" button in the Stats box.
// Nothing is final until "Apply": "Later" throws the unapplied clicks away and keeps the points.
import { ATTRIBUTE_KEYS, ATTRIBUTE_LABELS, EFFECT_TEXT, MAX_ATTRIBUTE, pointsAvailable } from "../rules.mjs";

export default class AttributesMenu {
	// attributes: the player's own object (changed in place), getLevel: () => player level, onChange: after "Apply"
	constructor(doc, attributes, getLevel, onChange = () => {}) {
		this.doc = doc;
		this.attributes = attributes;
		this.getLevel = getLevel;
		this.onChange = onChange;
		this.pending = {};
		this.modal = doc.getElementById("attributesModal");
		this.title = doc.getElementById("attributesTitle");
		this.intro = doc.getElementById("attributesIntro");
		this.rows = doc.getElementById("attributesRows");
		this.apply = doc.getElementById("attributesApply");
		this.later = doc.getElementById("attributesLater");

		this.buildRows();
		this.apply.addEventListener("click", () => this.commit());
		this.later.addEventListener("click", () => this.close());
		this.modal.addEventListener("click", (event) => { if (event.target === this.modal) this.close(); });
		doc.addEventListener("keydown", (event) => { if (event.key === "Escape" && this.isOpen()) this.close(); });
	}

	buildRows() {
		this.cells = {};
		for (const key of ATTRIBUTE_KEYS) {
			const row = this.doc.createElement("div");
			row.className = "attribute-row";
			const name = this.doc.createElement("div");
			name.className = "attribute-name";
			const effect = this.doc.createElement("small");
			const label = this.doc.createElement("span");
			name.append(label, effect);
			const plus = this.doc.createElement("button");
			plus.type = "button";
			plus.className = "button attribute-plus";
			plus.textContent = "+";
			plus.setAttribute("aria-label", "Add a point to " + ATTRIBUTE_LABELS[key]);
			plus.addEventListener("click", () => this.add(key, 1));
			const plusFive = this.doc.createElement("button");
			plusFive.type = "button";
			plusFive.className = "button attribute-plus";
			plusFive.textContent = "+5";
			plusFive.setAttribute("aria-label", "Add five points to " + ATTRIBUTE_LABELS[key]);
			plusFive.addEventListener("click", () => this.add(key, 5));
			row.append(name, plus, plusFive);
			this.rows.appendChild(row);
			this.cells[key] = { label, effect, plus, plusFive };
		}
	}

	isOpen() {
		return this.modal.style.display === "block";
	}

	pendingTotal() {
		return ATTRIBUTE_KEYS.reduce((sum, key) => sum + (this.pending[key] || 0), 0);
	}

	available() {
		return pointsAvailable(this.getLevel(), this.attributes) - this.pendingTotal();
	}

	add(key, amount) {
		const room = Math.min(amount, this.available(), MAX_ATTRIBUTE - this.attributes[key] - (this.pending[key] || 0));
		if (room <= 0) return;
		this.pending[key] = (this.pending[key] || 0) + room;
		this.render();
	}

	// levelUp: true when the window opens because a level was just reached
	open(levelUp = false) {
		this.pending = {};
		this.levelUp = levelUp;
		this.modal.style.display = "block";
		this.render();
		this.apply.focus();
	}

	close() {
		this.pending = {};
		this.modal.style.display = "none";
	}

	commit() {
		for (const key of ATTRIBUTE_KEYS) this.attributes[key] += this.pending[key] || 0;
		this.close();
		this.onChange();
	}

	render() {
		const left = this.available();
		this.title.textContent = this.levelUp ? "Level " + this.getLevel() + "!" : "Attributes";
		this.intro.textContent = left > 0
			? "You have " + left + (left === 1 ? " point" : " points") + " to spend."
			: "You have no points left to spend. You get 5 more with every level.";
		for (const key of ATTRIBUTE_KEYS) {
			const level = this.attributes[key] + (this.pending[key] || 0);
			const cell = this.cells[key];
			cell.label.textContent = ATTRIBUTE_LABELS[key] + " " + level + (this.pending[key] ? " (+" + this.pending[key] + ")" : "");
			cell.effect.textContent = EFFECT_TEXT[key](level);
			cell.plus.disabled = left < 1 || level >= MAX_ATTRIBUTE;
			cell.plusFive.disabled = left < 5 || level + 5 > MAX_ATTRIBUTE;
		}
		this.apply.disabled = this.pendingTotal() === 0;
	}
}
