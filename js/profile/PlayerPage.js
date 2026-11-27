// The character page: player.html?name=Vlad
// Shows the look, description, stats and map of a player, as far as that player allows.
// Everything typed by players goes in with textContent, never as HTML.
import { PROFILE_API_URL } from "../chat/chatConfig.js";
import { ACCENTS, drawAvatar, defaultAvatar } from "./Avatar.js";
import formatNumber from "../formatNumber.js";
import MapZoom from "../MapZoom.js";
import { ATTRIBUTE_KEYS, ATTRIBUTE_LABELS } from "../rules.mjs";

const root = document.getElementById("playerRoot");
const name = new URLSearchParams(location.search).get("name") || "";

const TILE_IMAGES = {
	0: "src/grass.png", 1: "src/smallHut.png", 2: "src/water.png", 3: "src/rock.png", 4: "src/mine.png",
	5: "src/farm.png", 6: "src/forest.png", 7: "src/lumbermill.png", 8: "src/bloodtemple.png", 9: "src/cave.png",
	// the war tiles are written as letters in the map: a b c d e = 10 to 14
	a: "src/watchtower.png", b: "src/guardoutpost.png", c: "src/fort.png", d: "src/enemyoutpost.png", e: "src/heldtile.png", f: "src/tavern.png", g: "src/mansion.png", h: "src/road.png", i: "src/bazaar.png",
};
const BUILDINGS = [["Huts", 1], ["Farms", 5], ["Mines", 4], ["Lumber mills", 7], ["Blood temples", 8], ["Watch towers", "a"], ["Guard outposts", "b"], ["Forts", "c"]];
const STATS = [
	["Blood", "blood"], ["Human food", "humanFood"], ["Wood", "wood"], ["Iron", "iron"],
	["Bronze", "bronze"], ["Gold", "gold"], ["Familiars", "familiars"], ["Influence", "influence"],
];

function element(tag, className, text) {
	const node = document.createElement(tag);
	if (className) node.className = className;
	if (text !== undefined) node.textContent = text;
	return node;
}

function message(text) {
	root.replaceChildren(element("p", "player-message", text));
}

function banner(player, isPrivate) {
	const box = element("div", "player-banner");
	box.style.setProperty("--accent", ACCENTS[player.accent] || ACCENTS[0]);
	const canvas = document.createElement("canvas");
	drawAvatar(canvas, player.avatar || defaultAvatar(player.vampireName), player.helmet || 0);
	canvas.setAttribute("role", "img");
	canvas.setAttribute("aria-label", "Portrait of " + player.vampireName);

	const text = element("div");
	text.appendChild(element("h1", "", player.vampireName));
	if (!isPrivate) text.appendChild(element("p", "sub", "of " + player.settlementName));
	const line = element("p", "sub");
	if (player.online) line.appendChild(element("span", "online-dot"));
	line.append((player.online ? "Online now · " : "") + "Level " + player.level);
	text.appendChild(line);
	if (player.mansion) {
		const visit = element("a", "button", "Visit mansion");
		visit.href = "play.html?visit=" + encodeURIComponent(player.vampireName);
		visit.style.display = "inline-block";
		visit.style.margin = "0.4rem 0";
		text.appendChild(visit);
	}
	if (!isPrivate && player.bio) text.appendChild(element("p", "bio", player.bio));
	box.append(canvas, text);
	return box;
}

function panel(title) {
	const box = element("section", "player-panel");
	box.appendChild(element("h2", "", title));
	return box;
}

function statsPanel(player) {
	const box = panel("Stats");
	const grid = element("div", "player-stats");
	const add = (label, value) => {
		const cell = element("div", "player-stat");
		cell.append(element("span", "", label), element("strong", "", value));
		grid.appendChild(cell);
	};
	if (player.stats) for (const [label, key] of STATS) add(label, formatNumber(player.stats[key] || 0));
	else {
		add("Influence", formatNumber(player.influence || 0));
		add("Familiars", formatNumber(player.familiars || 0));
	}
	if (player.attributes) for (const key of ATTRIBUTE_KEYS) add(ATTRIBUTE_LABELS[key], player.attributes[key]);
	add("Dice wins", formatNumber(player.diceWins || 0));
	if (player.createdAt) add("Joined", new Date(player.createdAt).toLocaleDateString());
	box.appendChild(grid);
	return box;
}

function loadImage(src) {
	return new Promise((resolve) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = () => resolve(null);
		image.src = src;
	});
}

// Look around by dragging with the mouse (touch screens scroll by themselves)
function enableDragScroll(box) {
	let start = null;
	box.addEventListener("pointerdown", (event) => {
		if (event.pointerType === "touch") return;
		start = { x: event.clientX, y: event.clientY, left: box.scrollLeft, top: box.scrollTop };
		box.setPointerCapture(event.pointerId);
		box.classList.add("dragging");
	});
	box.addEventListener("pointermove", (event) => {
		if (!start) return;
		box.scrollLeft = start.left - (event.clientX - start.x);
		box.scrollTop = start.top - (event.clientY - start.y);
	});
	const stop = () => { start = null; box.classList.remove("dragging"); };
	box.addEventListener("pointerup", stop);
	box.addEventListener("pointercancel", stop);
}

async function mapPanel(player) {
	const { width, height, tiles, levels } = player.map;
	const box = panel(player.settlementName);

	const counts = {};
	for (const char of tiles) counts[char] = (counts[char] || 0) + 1;
	const summary = BUILDINGS.map(([label, type]) => [label, counts[type] || 0]).filter(([, count]) => count > 0);
	if (summary.length) {
		const line = element("p", "", summary.map(([label, count]) => `${label}: ${count}`).join("  ·  "));
		line.style.fontSize = "1.3rem";
		box.appendChild(line);
	}

	const SIZE = 16;
	const canvas = document.createElement("canvas");
	canvas.id = "playerMap";
	canvas.width = width * SIZE;
	canvas.height = height * SIZE;
	canvas.setAttribute("role", "img");
	canvas.setAttribute("aria-label", "Map of " + player.settlementName);
	// The canvas is as wide as the tile size (a CSS variable) says, so MapZoom can zoom it like the game map
	canvas.style.width = `calc(var(--tile-size) * ${width})`;
	const wrap = element("div", "player-map-wrap");
	wrap.appendChild(canvas);
	const hint = element("p", "map-hint", "Scroll the mouse wheel to zoom, drag the map to look around.");
	const zoom = new MapZoom(wrap, { size: 16, min: 8, max: 96, storageKey: null });
	const buttons = element("div", "player-map-buttons");
	for (const [label, text, action] of [["Zoom out", "\u2212", () => zoom.zoomBy(1 / 1.3)], ["Zoom in", "+", () => zoom.zoomBy(1.3)]]) {
		const button = element("button", "button", text);
		button.type = "button";
		button.setAttribute("aria-label", label);
		button.addEventListener("click", action);
		buttons.appendChild(button);
	}
	box.append(hint, buttons, wrap);
	enableDragScroll(wrap);

	const images = {};
	await Promise.all(Object.entries(TILE_IMAGES).map(async ([type, src]) => { images[type] = await loadImage(src); }));
	const context = canvas.getContext("2d");
	context.imageSmoothingEnabled = false;
	for (let i = 0; i < width * height; i++) {
		const x = (i % width) * SIZE;
		const y = Math.floor(i / width) * SIZE;
		if (images[0]) context.drawImage(images[0], x, y, SIZE, SIZE);
		const type = tiles[i];
		if (type !== "0" && images[type]) context.drawImage(images[type], x, y, SIZE, SIZE);
		const level = parseInt(levels[i], 36);
		if (level > 0) {
			context.fillStyle = "rgba(0,0,0,0.75)";
			context.fillRect(x + SIZE - 8, y + SIZE - 7, 8, 7);
			context.fillStyle = "#f4d58a";
			context.font = "bold 7px monospace";
			context.fillText(String(level), x + SIZE - 7 - (level > 9 ? 1 : 0), y + SIZE - 1);
		}
	}
	return box;
}

async function show() {
	if (!name) return message("No vampire was chosen. Open a character page from the leaderboard or the chat.");
	let player;
	try {
		const response = await fetch(`${PROFILE_API_URL}?name=${encodeURIComponent(name)}`, { cache: "no-store" });
		const data = await response.json().catch(() => ({}));
		if (response.status === 404) return message("No vampire called “" + name + "” was found.");
		if (!response.ok) throw new Error(data.error || "HTTP " + response.status);
		player = data;
	} catch {
		return message("The character page could not be loaded (the game server cannot be reached).");
	}

	document.title = player.vampireName + " - BLOOD & EARTH";
	if (player.private) {
		root.replaceChildren(banner(player, true), Object.assign(element("p", "player-message", "This vampire keeps their page private."), {}));
		return;
	}
	const parts = [banner(player, false), statsPanel(player)];
	root.replaceChildren(...parts);
	if (player.map) root.appendChild(await mapPanel(player));
	else if (!player.stats) root.appendChild(element("p", "player-message", "The map is hidden."));
}

show();
