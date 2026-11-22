// GIF search for the chat, using GIPHY. Adds a "GIF" button to the chat form and a
// small panel with a search box and the results; clicking a GIF sends it to the chat.
// (Chat.js turns the sent link into a picture.)

const API = "https://api.giphy.com/v1/gifs";
const SEARCH_DELAY_MS = 400;
const RESULTS = 18;

export default class GifPicker {
	constructor(chat, apiKey, doc = document) {
		this.chat = chat;
		this.apiKey = apiKey;
		this.form = doc.getElementById("chatForm");
		this.requestCount = 0; // so a slow, old answer cannot replace a newer one
		this.timer = null;
		this.loadedOnce = false;
	}

	start() {
		if (!this.apiKey || !this.form) return; // no key: no GIF button

		this.button = document.createElement("button");
		this.button.type = "button";
		this.button.className = "button";
		this.button.textContent = "GIF";
		this.button.setAttribute("aria-expanded", "false");
		this.form.insertBefore(this.button, document.getElementById("chatSend"));

		this.panel = document.createElement("div");
		this.panel.className = "gif-panel";
		this.panel.hidden = true;

		this.search = document.createElement("input");
		this.search.type = "search";
		this.search.placeholder = "Search GIFs…";
		this.search.maxLength = 50;
		this.search.setAttribute("aria-label", "Search GIFs");

		this.status = document.createElement("p");
		this.status.className = "gif-status";
		this.status.setAttribute("role", "status");

		this.grid = document.createElement("div");
		this.grid.className = "gif-grid";

		const credit = document.createElement("p");
		credit.className = "gif-credit";
		credit.textContent = "Powered by GIPHY";

		this.panel.append(this.search, this.status, this.grid, credit);
		this.form.parentNode.insertBefore(this.panel, this.form);

		this.button.addEventListener("click", () => (this.panel.hidden ? this.open() : this.close()));
		this.search.addEventListener("input", () => {
			clearTimeout(this.timer);
			this.timer = setTimeout(() => this.load(), SEARCH_DELAY_MS);
		});
		this.search.addEventListener("keydown", (event) => {
			if (event.key === "Escape") this.close();
			if (event.key === "Enter") { event.preventDefault(); clearTimeout(this.timer); this.load(); }
		});
	}

	open() {
		this.panel.hidden = false;
		this.button.setAttribute("aria-expanded", "true");
		this.search.focus();
		if (!this.loadedOnce) this.load(); // trending GIFs to start with
	}

	close() {
		this.panel.hidden = true;
		this.button.setAttribute("aria-expanded", "false");
	}

	async load() {
		const thisRequest = ++this.requestCount;
		const query = this.search.value.trim();
		const params = new URLSearchParams({ api_key: this.apiKey, limit: RESULTS, rating: "pg" });
		if (query) params.set("q", query);
		this.status.textContent = "Loading…";
		try {
			const response = await fetch(`${API}/${query ? "search" : "trending"}?${params}`);
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const data = await response.json();
			if (!Array.isArray(data.data)) throw new Error("Unexpected answer");
			if (thisRequest !== this.requestCount) return;
			this.loadedOnce = true;
			this.render(data.data);
			this.status.textContent = data.data.length ? "" : "No GIFs found.";
		} catch {
			if (thisRequest !== this.requestCount) return;
			this.grid.replaceChildren();
			this.status.textContent = "Could not load GIFs right now.";
		}
	}

	render(items) {
		const buttons = [];
		for (const item of items) {
			const preview = item && item.images && (item.images.fixed_height_small || item.images.fixed_height);
			if (!item.id || !preview || !preview.url) continue;
			const id = String(item.id);
			if (!/^[A-Za-z0-9]+$/.test(id)) continue;

			const button = document.createElement("button");
			button.type = "button";
			button.className = "gif-choice";
			button.title = item.title || "GIF";
			const image = document.createElement("img");
			image.src = preview.url;
			image.alt = item.title || "GIF";
			image.loading = "lazy";
			image.referrerPolicy = "no-referrer";
			button.appendChild(image);
			// A short, fixed link that works for every GIPHY id
			button.addEventListener("click", () => {
				this.chat.send(`https://media.giphy.com/media/${id}/giphy.gif`);
				this.close();
			});
			buttons.push(button);
		}
		this.grid.replaceChildren(...buttons);
	}
}
