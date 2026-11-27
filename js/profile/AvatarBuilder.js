// The character builder: a preview and one "< choice >" row for every part.
// Used when signing up and in the "My character" window.
import { OPTIONS, LABELS, KEYS, allowedChoices, drawAvatar, normalizeAvatar, randomAvatar } from "./Avatar.js";

export default class AvatarBuilder {
	// container: an empty element to fill. avatar: the starting choices. onChange: called after every change.
	constructor(container, avatar, onChange = () => {}, owned = () => ({})) {
		this.owned = owned; // () => { hair: [item numbers], robe: [...], shirt: [...], armor: [...], weapon: [...] }
		this.container = container;
		this.onChange = onChange;
		this.avatar = normalizeAvatar(avatar);
		this.valueLabels = {};
		this.build();
		this.redraw();
	}

	build() {
		this.container.classList.add("avatar-builder");
		this.canvas = document.createElement("canvas");
		this.canvas.className = "avatar-canvas";
		this.canvas.setAttribute("role", "img");
		this.canvas.setAttribute("aria-label", "Your character");

		const rows = document.createElement("div");
		rows.className = "avatar-rows";
		for (const key of KEYS) {
			const row = document.createElement("div");
			row.className = "avatar-row";
			const label = document.createElement("span");
			label.className = "avatar-label";
			label.textContent = LABELS[key];
			const previous = this.stepButton("◀", key, -1, "Previous " + LABELS[key].toLowerCase());
			const value = document.createElement("span");
			value.className = "avatar-value";
			value.setAttribute("aria-live", "polite");
			this.valueLabels[key] = value;
			const next = this.stepButton("▶", key, 1, "Next " + LABELS[key].toLowerCase());
			row.append(label, previous, value, next);
			rows.appendChild(row);
		}

		const random = document.createElement("button");
		random.type = "button";
		random.className = "button avatar-random";
		random.textContent = "Surprise me";
		random.addEventListener("click", () => {
			const next = randomAvatar();
			for (const key of ["hairStyle", "cloak", "weapon"]) { const list = allowedChoices(key, this.owned()); next[key] = list[Math.floor(Math.random() * list.length)]; }
			this.setValue(next);
		});

		const left = document.createElement("div");
		left.className = "avatar-preview";
		left.append(this.canvas, random);
		this.container.replaceChildren(left, rows);
	}

	stepButton(symbol, key, direction, label) {
		const button = document.createElement("button");
		button.type = "button"; // never submits the sign-up form
		button.className = "avatar-step";
		button.textContent = symbol;
		button.setAttribute("aria-label", label);
		button.addEventListener("click", () => {
			const list = allowedChoices(key, this.owned());
			const at = list.indexOf(this.avatar[key]);
			this.avatar[key] = list[((at < 0 ? 0 : at) + direction + list.length) % list.length];
			this.redraw();
			this.onChange(this.getValue());
		});
		return button;
	}

	redraw() {
		drawAvatar(this.canvas, this.avatar);
		for (const key of KEYS) this.valueLabels[key].textContent = OPTIONS[key][this.avatar[key]];
	}

	getValue() {
		return { ...this.avatar };
	}

	setValue(avatar) {
		this.avatar = normalizeAvatar(avatar);
		this.redraw();
		this.onChange(this.getValue());
	}
}
