// "How to play" pop-up. Opens with the header button, and once on its own for a brand new
// player (right after they name their vampire). Whether it was shown is remembered in the browser.

const SEEN_KEY = "vampireHelpSeen";

export default class HowToPlay {
	constructor(doc = document) {
		this.modal = doc.getElementById("helpModal");
		this.openButton = doc.getElementById("helpButton");
		this.closeButton = doc.getElementById("helpClose");
		this.okButton = doc.getElementById("helpOk");
	}

	start() {
		this.openButton.addEventListener("click", () => this.open());
		this.okButton.addEventListener("click", () => this.close());
		this.closeButton.addEventListener("click", () => this.close());
		this.closeButton.addEventListener("keydown", (event) => {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				this.close();
			}
		});
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
		this.okButton.focus({ preventScroll: true }); // keep the top of the text in view
		this.modal.scrollTop = 0;
		this.remember();
	}

	close() {
		this.modal.style.display = "none";
		this.openButton.focus();
	}

	// For new players: open it, but only the first time.
	showOnce() {
		if (!this.wasSeen()) this.open();
	}

	wasSeen() {
		try {
			return localStorage.getItem(SEEN_KEY) === "1";
		} catch {
			return false;
		}
	}

	remember() {
		try {
			localStorage.setItem(SEEN_KEY, "1");
		} catch {
			// Not being able to remember it is fine.
		}
	}
}
