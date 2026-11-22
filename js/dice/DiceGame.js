// Dice game pop-up: two players bet the same bundle of resources, the server rolls two dice
// for each, and the higher total takes both bundles (a tie gives everything back).
// Talks to /api/dice in server.js. The server rolls the dice and keeps the bets safe; this file
// shows the lobby and applies the server's "settlements" (+/- resources) to the player's storage.

const RESOURCES = [
	["blood", "Blood"],
	["humanFood", "Human food"],
	["wood", "Wood"],
	["iron", "Iron"],
	["bronze", "Bronze"],
	["gold", "Gold"],
];
const NAMES = Object.fromEntries(RESOURCES.map(([key, label]) => [key, label.toLowerCase()]));

const POLL_OPEN_MS = 4000;     // while the pop-up is open
const POLL_CLOSED_MS = 15000;  // in the background (so results and refunds still arrive)
const ROLL_ANIMATION_MS = 1000;
const REMEMBERED_RESULTS = 300; // how many applied settlement ids are kept (so none is applied twice)

export default class DiceGame {
	// options:
	//   apiUrl, getPlayerId() (null until signed up),
	//   getItems()    -> the storage object { blood, humanFood, wood, iron, bronze, gold }
	//   onChange()    -> called after the storage was changed (the game saves)
	//   log(text)     -> shows a line in the Updates box
	//   applied       -> { ids: [] } remembered in the save
	constructor(options, doc = document) {
		this.o = options;
		this.modal = doc.getElementById("diceModal");
		this.openButton = doc.getElementById("diceButton");
		this.closeButton = doc.getElementById("diceClose");
		this.statusLine = doc.getElementById("diceStatus");
		this.winsLine = doc.getElementById("diceWins");
		this.inputsBox = doc.getElementById("diceStakeInputs");
		this.targetInput = doc.getElementById("diceTarget");
		this.createButton = doc.getElementById("diceCreate");
		this.resultBox = doc.getElementById("diceResult");
		this.lists = {
			incoming: doc.getElementById("diceIncoming"),
			open: doc.getElementById("diceLobby"),
			mine: doc.getElementById("diceMine"),
			recent: doc.getElementById("diceRecent"),
		};
		this.state = null;
		this.polling = false;
		this.timer = null;
		this.inputs = {};
		this.animationTimer = null;
	}

	start() {
		this.buildInputs();
		this.openButton.addEventListener("click", () => this.open());
		this.closeButton.addEventListener("click", () => this.close());
		this.closeButton.addEventListener("keydown", (event) => {
			if (event.key === "Enter" || event.key === " ") { event.preventDefault(); this.close(); }
		});
		this.modal.addEventListener("click", (event) => {
			if (event.target === this.modal) this.close(); // click on the dark background
		});
		document.addEventListener("keydown", (event) => {
			if (event.key === "Escape" && this.isOpen()) this.close();
		});
		this.createButton.addEventListener("click", () => this.create());
		setTimeout(() => this.poll(), 1500); // after the game has loaded its save
	}

	isOpen() {
		return this.modal.style.display === "block";
	}

	open() {
		this.modal.style.display = "block";
		this.closeButton.focus({ preventScroll: true });
		this.modal.scrollTop = 0;
		this.refreshHave();
		if (!this.o.getPlayerId()) this.setStatus("Name your vampire first, then you can play dice.");
		this.pollNow();
	}

	close() {
		this.modal.style.display = "none";
		this.openButton.focus();
		this.schedule();
	}

	// ---------- Talking to the server ----------
	async call(action, extra = {}) {
		const id = this.o.getPlayerId();
		if (!id) return { ok: false, error: "Name your vampire first." };
		try {
			const response = await fetch(this.o.apiUrl, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id, action, ...extra }),
			});
			const data = await response.json().catch(() => ({}));
			if (!response.ok) return { ok: false, error: data.error || "Something went wrong." };
			return { ok: true, data };
		} catch {
			return { ok: false, error: "The game server cannot be reached.", offline: true };
		}
	}

	pollNow() {
		clearTimeout(this.timer);
		return this.poll();
	}

	schedule() {
		clearTimeout(this.timer);
		this.timer = setTimeout(() => this.poll(), this.isOpen() ? POLL_OPEN_MS : POLL_CLOSED_MS);
	}

	async poll() {
		if (this.polling) return;
		this.polling = true;
		try {
			if (!this.o.getPlayerId()) return;
			const result = await this.call("state");
			if (!result.ok) {
				if (this.isOpen()) this.setStatus(result.error);
				return;
			}
			this.state = result.data;
			await this.applySettlements(result.data.settlements || []);
			if (this.isOpen()) {
				this.setStatus("");
				this.render();
			}
		} finally {
			this.polling = false;
			this.schedule();
		}
	}

	// ---------- Changing the player's storage ----------
	// Each settlement is applied exactly once: its id is remembered in the save before the
	// server is told it can forget it.
	async applySettlements(list) {
		if (!list.length) return;
		const known = new Set(this.o.applied.ids);
		let changed = false;
		const shown = [];

		for (const settlement of list) {
			if (known.has(settlement.id)) continue;
			const items = this.o.getItems();
			for (const [kind, amount] of Object.entries(settlement.delta || {})) {
				if (!(kind in NAMES) || !Number.isFinite(amount)) continue;
				items[kind] = Math.max(0, items[kind] + amount); // never below 0
			}
			known.add(settlement.id);
			this.o.applied.ids.push(settlement.id);
			changed = true;
			shown.push(settlement);
		}
		if (this.o.applied.ids.length > REMEMBERED_RESULTS) {
			this.o.applied.ids.splice(0, this.o.applied.ids.length - REMEMBERED_RESULTS);
		}
		if (changed) this.o.onChange(); // saves the game (and the remembered ids)

		await this.call("ack", { ids: list.map((s) => s.id) });

		for (const settlement of shown) {
			if (settlement.message) this.o.log(settlement.message);
			if (settlement.match) this.showResult(settlement.match, settlement.message);
		}
		if (changed) this.refreshHave();
	}

	// ---------- Making and answering challenges ----------
	items() {
		const items = this.o.getItems();
		return Object.fromEntries(RESOURCES.map(([kind]) => [kind, Math.floor(items[kind] || 0)]));
	}

	readStake() {
		const have = this.items();
		const stake = {};
		for (const [kind, label] of RESOURCES) {
			const raw = this.inputs[kind].value.trim();
			if (raw === "") continue;
			const value = Number(raw);
			if (!Number.isInteger(value) || value < 0) return { error: label + ": use a whole number." };
			if (value > have[kind]) return { error: "You only have " + have[kind] + " " + NAMES[kind] + "." };
			if (value > 0) stake[kind] = value;
		}
		if (Object.keys(stake).length === 0) return { error: "Choose something to bet." };
		return { stake };
	}

	async create() {
		const { stake, error } = this.readStake();
		if (error) return this.setStatus(error);
		this.createButton.disabled = true;
		this.setStatus("Posting your challenge…");
		const result = await this.call("create", { stake, target: this.targetInput.value.trim() });
		this.createButton.disabled = false;
		if (!result.ok) return this.setStatus(result.error);

		for (const kind of Object.keys(this.inputs)) this.inputs[kind].value = "";
		this.targetInput.value = "";
		this.setStatus("Challenge posted. Your bet is set aside until someone answers it.");
		await this.pollNow(); // collects the settlement that takes the bet out of storage
	}

	// What stops this player from accepting a bet (or "" if they can afford it)
	missing(stake) {
		const have = this.items();
		const lacking = Object.entries(stake).filter(([kind, n]) => have[kind] < n).map(([kind, n]) => (n - have[kind]) + " more " + NAMES[kind]);
		return lacking.join(", ");
	}

	async accept(challenge) {
		const lacking = this.missing(challenge.stake);
		if (lacking) return this.setStatus("You cannot cover this bet: you need " + lacking + ".");
		if (!confirm("Bet " + stakeText(challenge.stake) + " against " + challenge.creator + "?\nHigher roll of two dice wins both bets. A tie returns everything.")) return;
		this.setStatus("Rolling…");
		const result = await this.call("accept", { challengeId: challenge.id });
		if (!result.ok) {
			this.setStatus(result.error);
			return this.pollNow();
		}
		await this.pollNow(); // the result and the payout arrive as settlements
	}

	async cancel(challenge) {
		const result = await this.call("cancel", { challengeId: challenge.id });
		if (!result.ok) this.setStatus(result.error);
		await this.pollNow();
	}

	// ---------- Showing things ----------
	setStatus(text) {
		this.statusLine.textContent = text;
	}

	buildInputs() {
		for (const [kind, label] of RESOURCES) {
			const wrap = document.createElement("label");
			wrap.className = "dice-input";
			const name = document.createElement("span");
			name.textContent = label;
			const input = document.createElement("input");
			input.type = "number";
			input.min = "0";
			input.step = "1";
			input.inputMode = "numeric";
			input.placeholder = "0";
			const have = document.createElement("small");
			have.dataset.have = kind;
			wrap.append(name, input, have);
			this.inputsBox.appendChild(wrap);
			this.inputs[kind] = input;
		}
	}

	// "you have N" under each box, and the biggest bet you can make
	refreshHave() {
		const have = this.items();
		for (const [kind] of RESOURCES) {
			const label = this.inputsBox.querySelector('[data-have="' + kind + '"]');
			if (label) label.textContent = "you have " + have[kind];
			this.inputs[kind].max = String(have[kind]);
		}
	}

	render() {
		const state = this.state;
		if (!state) return;
		this.winsLine.textContent = "Dice wins: " + (state.wins || 0);
		this.renderChallenges(this.lists.incoming, state.incoming, "No one has challenged you.", (challenge) => [
			button("Accept", () => this.accept(challenge), this.missing(challenge.stake)),
			button("Decline", () => this.cancel(challenge)),
		]);
		this.renderChallenges(this.lists.open, state.open, "No open challenges. Make one above!", (challenge) => [
			button("Accept", () => this.accept(challenge), this.missing(challenge.stake)),
		]);
		this.renderChallenges(this.lists.mine, state.mine, "You have no open challenges.", (challenge) => [
			button("Cancel", () => this.cancel(challenge)),
		]);
		this.renderRecent(state.recent || []);
	}

	renderChallenges(list, challenges, emptyText, makeButtons) {
		if (!challenges.length) {
			list.replaceChildren(emptyItem(emptyText));
			return;
		}
		list.replaceChildren(...challenges.map((challenge) => {
			const row = document.createElement("li");
			const text = document.createElement("span");
			// textContent: names are typed by players
			const who = challenge.target ? challenge.creator + " vs " + challenge.target : challenge.creator;
			text.textContent = who + ": " + stakeText(challenge.stake);
			row.appendChild(text);
			row.append(...makeButtons(challenge));
			return row;
		}));
	}

	renderRecent(matches) {
		if (!matches.length) {
			this.lists.recent.replaceChildren(emptyItem("No games played yet."));
			return;
		}
		this.lists.recent.replaceChildren(...[...matches].reverse().map((m) => {
			const row = document.createElement("li");
			const a = m.creatorDice[0] + m.creatorDice[1];
			const b = m.acceptorDice[0] + m.acceptorDice[1];
			const bet = stakeText(m.stake);
			row.textContent = m.outcome === "tie"
				? m.creator + " and " + m.acceptor + " tied (" + a + " each), " + bet + " returned"
				: (m.outcome === "creator" ? m.creator : m.acceptor) + " beat " +
				  (m.outcome === "creator" ? m.acceptor : m.creator) + " (" + Math.max(a, b) + " to " + Math.min(a, b) + ") and won " + bet;
			return row;
		}));
	}

	// The dice roll for the player's own game, shown in the pop-up
	showResult(match, message) {
		if (!this.isOpen()) return;
		clearInterval(this.animationTimer);
		const face = () => 1 + Math.floor(Math.random() * 6);
		const makeDice = (values, who) => {
			const group = document.createElement("div");
			group.className = "dice-group";
			const label = document.createElement("span");
			label.textContent = who;
			group.appendChild(label);
			const faces = values.map(() => {
				const die = document.createElement("b");
				die.className = "die";
				group.appendChild(die);
				return die;
			});
			return { group, faces };
		};
		const mine = makeDice(match.you, "You");
		const theirs = makeDice(match.them, match.opponent);
		const text = document.createElement("p");
		text.className = "dice-result-text dice-" + match.outcome;
		this.resultBox.replaceChildren(mine.group, theirs.group, text);
		this.resultBox.hidden = false;

		const started = Date.now();
		const tick = () => {
			const done = Date.now() - started >= ROLL_ANIMATION_MS;
			mine.faces.forEach((die, i) => { die.textContent = done ? match.you[i] : face(); });
			theirs.faces.forEach((die, i) => { die.textContent = done ? match.them[i] : face(); });
			if (done) {
				clearInterval(this.animationTimer);
				text.textContent = message;
			} else {
				text.textContent = "Rolling…";
			}
		};
		tick();
		this.animationTimer = setInterval(tick, 80);
	}
}

function stakeText(stake) {
	return Object.entries(stake).map(([kind, n]) => n + " " + (NAMES[kind] || kind)).join(", ");
}

function emptyItem(text) {
	const item = document.createElement("li");
	item.className = "dice-empty";
	item.textContent = text;
	return item;
}

// disabledReason: when given, the button is greyed out and the reason is its tooltip
function button(label, onClick, disabledReason = "") {
	const element = document.createElement("button");
	element.type = "button";
	element.className = "button";
	element.textContent = label;
	if (disabledReason) {
		element.disabled = true;
		element.title = "You need " + disabledReason;
	} else {
		element.addEventListener("click", onClick);
	}
	return element;
}
