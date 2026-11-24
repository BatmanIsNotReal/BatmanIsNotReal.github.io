// The window that opens when you click the cave on the map: a short text, the way in, and a list of
// who is down there right now (asked from the server every few seconds while the window is open).
import { DUNGEONS } from "../rules.mjs";
import { makeProfileLink } from "../profile/profileLink.js";

export default class CaveMenu {
	// options: { apiUrl, getLevel(), canEnter() -> bool, onEnter(dungeonId) }
	constructor(document, options) {
		this.document = document;
		this.options = options;
		this.modal = document.getElementById("caveModal");
		this.choice = document.getElementById("caveChoice");
		this.levels = document.getElementById("caveLevels");
		this.levelRows = document.getElementById("caveLevelRows");
		this.who = document.getElementById("caveWho");
		this.note = document.getElementById("caveNote");
		this.dungeons = [];
		document.getElementById("caveEnter").addEventListener("click", () => this.showLevels());
		document.getElementById("caveNo").addEventListener("click", () => this.close());
		document.getElementById("caveBack").addEventListener("click", () => this.showChoice());
		this.modal.addEventListener("click", (e) => { if (e.target === this.modal) this.close(); });
		document.addEventListener("keydown", (e) => { if (e.key === "Escape" && this.isOpen()) this.close(); });
	}

	isOpen() {
		return this.modal.style.display === "block";
	}

	open() {
		this.showChoice();
		this.modal.style.display = "block";
		this.refresh();
		clearInterval(this.timer);
		this.timer = setInterval(() => this.refresh(), 3000);
	}

	close() {
		this.modal.style.display = "none";
		clearInterval(this.timer);
	}

	showChoice() {
		this.choice.hidden = false;
		this.levels.hidden = true;
	}

	showLevels() {
		this.choice.hidden = true;
		this.levels.hidden = false;
		this.renderLevels();
	}

	async refresh() {
		try {
			const response = await fetch(this.options.apiUrl);
			if (!response.ok) throw new Error("status " + response.status);
			this.dungeons = (await response.json()).dungeons || [];
			this.offline = false;
		} catch {
			this.offline = true;
		}
		this.renderWho();
		if (!this.levels.hidden) this.renderLevels();
	}

	renderWho() {
		this.who.textContent = "";
		const d = this.document;
		if (this.offline) {
			const li = d.createElement("li");
			li.textContent = "The underground cannot be reached right now.";
			this.who.appendChild(li);
			return;
		}
		let any = false;
		for (const dungeon of this.dungeons) {
			for (const name of dungeon.players) {
				any = true;
				const li = d.createElement("li");
				const link = makeProfileLink(d.createElement("a"), name);
				link.textContent = name;
				li.append(link, " — " + dungeon.name);
				this.who.appendChild(li);
			}
		}
		if (!any) {
			const li = d.createElement("li");
			li.textContent = "Nobody at the moment.";
			this.who.appendChild(li);
		}
	}

	renderLevels() {
		const d = this.document;
		const level = this.options.getLevel();
		this.levelRows.textContent = "";
		this.note.textContent = this.options.canEnter() ? "" : "Awaken your vampire first: you must be signed up to enter.";
		for (const dungeon of DUNGEONS) {
			const live = this.dungeons.find((x) => x.id === dungeon.id);
			const locked = level < dungeon.min || !this.options.canEnter();
			const button = d.createElement("button");
			button.type = "button";
			button.className = "button cave-level";
			if (dungeon.pvp) button.classList.add("pvp");
			if (!dungeon.pvp && level >= dungeon.min && level <= dungeon.max) button.classList.add("fitting");
			button.disabled = locked;
			const range = dungeon.pvp ? `level ${dungeon.min}+ • player versus player` : `level ${dungeon.min}–${dungeon.max}`;
			const here = live ? live.players.length : 0;
			const title = d.createElement("span");
			title.className = "cave-level-name";
			title.textContent = dungeon.pvp ? "⚔ " + dungeon.name : dungeon.id + ". " + dungeon.name;
			const detail = d.createElement("span");
			detail.className = "cave-level-detail";
			detail.textContent = `${range} • ${here} here` + (level < dungeon.min ? ` • needs level ${dungeon.min}` : "");
			button.append(title, detail);
			button.addEventListener("click", () => { this.close(); this.options.onEnter(dungeon.id); });
			this.levelRows.appendChild(button);
		}
	}
}
