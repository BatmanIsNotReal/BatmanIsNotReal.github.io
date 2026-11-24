// Background music, sound effects and the mute button.
//
// The music starts as soon as the page loads. Browsers only allow sound after the
// player has clicked or pressed a key on the page, so if the first try is blocked,
// the music starts on the first click, tap or key press instead.

const MUTE_KEY = "vampireMuted";
const MUSIC_VOLUME = 0.5;
const GESTURE_EVENTS = ["pointerdown", "keydown", "touchstart"];

export default class MusicHandler {
	// music: the <audio id="backgroundMusic"> element
	// button: the mute button (optional)
	constructor(music, button = null) {
		this.music = music;
		this.button = button;
		this.buyVampire = new Audio("music/sounds/strigoiBought.mp3");
		this.toolUpgrade = new Audio("music/sounds/toolUpgrade.wav");
		this.spell = new Audio("music/sounds/spell.wav");
		this.spell.volume = 0.6;
		this.muted = this.loadMuted();
		this.waitingForGesture = false;
		this.onGesture = () => this.startAfterGesture();

		this.music.loop = true;
		this.music.volume = MUSIC_VOLUME;
		this.applyMute();

		if (this.button) {
			this.button.addEventListener("click", () => this.setMuted(!this.muted));
		}
	}

	// ---------- Music ----------
	start() {
		this.music.play().catch(() => {
			// Blocked until the player interacts with the page (or the file is missing).
			if (this.waitingForGesture) return;
			this.waitingForGesture = true;
			for (const name of GESTURE_EVENTS) document.addEventListener(name, this.onGesture, true);
		});
	}

	startAfterGesture() {
		this.waitingForGesture = false;
		for (const name of GESTURE_EVENTS) document.removeEventListener(name, this.onGesture, true);
		this.music.play().catch(() => {
			// Still not possible (for example the file is missing): the game works without music.
		});
	}

	// ---------- Mute ----------
	// Muting keeps the music running silently, so un-muting is instant and in the same place.
	setMuted(muted) {
		this.muted = muted;
		try {
			localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
		} catch {
			// The choice just will not be remembered.
		}
		this.applyMute();
	}

	applyMute() {
		this.music.muted = this.muted;
		if (!this.button) return;

		this.button.setAttribute("aria-pressed", String(this.muted));
		this.button.setAttribute("aria-label", this.muted ? "Turn sound on" : "Mute sound");
		const icon = this.button.querySelector("i");
		if (icon) icon.className = this.muted ? "fas fa-volume-mute" : "fas fa-volume-up";
		const label = this.button.querySelector("span");
		if (label) label.textContent = this.muted ? "Sound off" : "Sound on";
	}

	loadMuted() {
		try {
			return localStorage.getItem(MUTE_KEY) === "1";
		} catch {
			return false;
		}
	}

	// ---------- Sound effects ----------
	playBuyVamp() {
		if (this.muted) return;
		this.buyVampire.currentTime = 0;
		this.buyVampire.play().catch(() => {});
	}

	playToolUpgrade() {
		if (this.muted) return;
		this.toolUpgrade.currentTime = 0;
		this.toolUpgrade.play().catch(() => {});
	}

	// A spell being cast: tells the player that something happened (a random event)
	playSpell() {
		if (this.muted) return;
		this.spell.currentTime = 0;
		this.spell.play().catch(() => {});
	}
}
