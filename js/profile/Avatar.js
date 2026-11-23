// The vampire character: a small pixel-art figure built from freely combined parts.
// An avatar is just a few numbers (which hair, which cloak, which colours ...), so it is tiny to
// save and send. drawAvatar() paints it on a canvas, layer by layer.
//
// Each part is a picture of 16 characters per row. A letter is a colour role, "." is see-through:
//   S skin   s skin (shadow)   H hair   h hair (dark)   E eye colour   g eye glow
//   C cloak  c cloak (dark)    K black  W white  T tooth  R blood red  G gold  P bone

export const WIDTH = 16;
export const HEIGHT = 22;

// ---------- Colours ----------
export const SKIN_TONES = ["#f2dccb", "#e6bd9c", "#c68f65", "#8d5a3b", "#a9b4b8", "#9fb0d4"];
export const HAIR_COLORS = ["#1b1722", "#5a3a24", "#d6b25e", "#a8392a", "#e6e6ee", "#9a9aa8", "#5a1f5f", "#2d4a8f"];
export const EYE_COLORS = ["#e0283a", "#e8b930", "#46c46a", "#4aa3e8", "#a45be0", "#f0f0f0"];
export const CLOAK_COLORS = ["#2a2430", "#8f1d2c", "#4b2a6e", "#1f4d3a", "#1f3560", "#5a3a24", "#d8d2c4", "#b58a2e"];

const NAMES = {
	skin: ["Pale", "Fair", "Tan", "Brown", "Ashen", "Frost"],
	hairColor: ["Black", "Brown", "Blonde", "Red", "White", "Grey", "Plum", "Blue"],
	eyeColor: ["Crimson", "Gold", "Green", "Blue", "Violet", "White"],
	cloakColor: ["Night", "Crimson", "Purple", "Forest", "Navy", "Brown", "Ivory", "Gold"],
};

// ---------- Parts (each is { y: first row, rows: [...] }) ----------
const BASE_HEAD = {
	y: 3,
	rows: [
		".....SSSSSS.....",
		"....SSSSSSSS....",
		"....SSSSSSSS....",
		"....SSSSSSSS....",
		"....SSSSSSSS....",
		"....SSSSSSSS....",
		".....SSSSSS.....",
		"......SSSS......",
		".......ss.......", // neck
	],
};

const HAIR = [
	{ name: "Bald", part: null },
	{ name: "Short", part: { y: 2, rows: [
		".....HHHHHH.....",
		"....HHHHHHHH....",
		"....HH....HH....",
	] } },
	{ name: "Slicked", part: { y: 2, rows: [
		".....HHHHHH.....",
		"....HHHHHHHH....",
		"....HHHHHHHH....",
		"....Hh....hH....",
	] } },
	{ name: "Long", part: { y: 2, rows: [
		".....HHHHHH.....",
		"....HHHHHHHH....",
		"...HHHH..HHHH...",
		"...HHH....HHH...",
		"...HHH....HHH...",
		"...HHH....HHH...",
		"...HHH....HHH...",
		"...HHH....HHH...",
		"...HHH....HHH...",
		"..HHHH....HHHH..",
		"..HH........HH..",
	] } },
	{ name: "Spiky", part: { y: 0, rows: [
		".....H..H..H....",
		".....HH.HH.HH...",
		"....HHHHHHHHH...",
		"....HHHHHHHH....",
		"....Hh....hH....",
	] } },
	{ name: "Mohawk", part: { y: 0, rows: [
		".......HH.......",
		".......HH.......",
		"......HHHH......",
		"......HHHH......",
		".......hh.......",
	] } },
	{ name: "Bob", part: { y: 2, rows: [
		".....HHHHHH.....",
		"....HHHHHHHH....",
		"...HHHH..HHHH...",
		"...HHH....HHH...",
		"...HHH....HHH...",
		"...HHH....HHH...",
		"...HHH....HHH...",
		"...hHH....HHh...",
	] } },
];

const EYES = [
	{ name: "Calm", part: { y: 6, rows: [
		".....EE..EE.....",
	] } },
	{ name: "Big", part: { y: 5, rows: [
		".....WE..EW.....",
		".....EE..EE.....",
	] } },
	{ name: "Angry", part: { y: 5, rows: [
		"....KK....KK....",
		".....EE..EE.....",
	] } },
	{ name: "Glowing", part: { y: 5, rows: [
		".....gg..gg.....",
		".....EE..EE.....",
		".....gg..gg.....",
	] } },
	{ name: "Sleepy", part: { y: 6, rows: [
		".....KK..KK.....",
	] } },
];

const MOUTHS = [
	{ name: "Fangs", part: { y: 8, rows: [
		"......KKKK......",
		"......T..T......",
	] } },
	{ name: "Smirk", part: { y: 8, rows: [
		".......KKK......",
		".......T........",
	] } },
	{ name: "Grin", part: { y: 8, rows: [
		".....KTTTTK.....",
		"......KKKK......",
	] } },
	{ name: "Calm", part: { y: 8, rows: [
		"......KKKK......",
	] } },
	{ name: "Bloody", part: { y: 8, rows: [
		"......KKKK......",
		"......TRRT......",
	] } },
];

const CLOAKS = [
	{ name: "Robe", part: { y: 11, rows: [
		"....CCCssCCC....",
		"..CCCCCCccCCCCC.",
		"..CCCCCCccCCCCC.",
		"..CCCCCCccCCCCC.",
		"..CCCCCCccCCCCC.",
		"..CCCCCCccCCCCC.",
		"..CCCCCCccCCCCC.",
		"..CCCCCCccCCCCC.",
		".CCCCCCCccCCCCCC",
		".CCCCCCCccCCCCCC",
		".CCCCCCCccCCCCCC",
	] } },
	{ name: "High collar", part: { y: 8, rows: [
		"...C........C...",
		"...CC......CC...",
		"...CCC....CCC...",
		"...CCCCssCCCC...",
		"..CCCCCRRCCCCC..",
		"..CCCCCRRCCCCC..",
		"..CCCCCRRCCCCC..",
		"..CCCCCRRCCCCC..",
		"..CCCCCRRCCCCC..",
		"..CCCCCRRCCCCC..",
		".CCCCCCRRCCCCCC.",
		".CCCCCCRRCCCCCC.",
		".CCCCCCRRCCCCCC.",
		".CCCCCCRRCCCCCC.",
	] } },
	{ name: "Armour", part: { y: 11, rows: [
		"....GGGssGGG....",
		".GGGCCCCCCCCGGG.",
		".GGGCCCCCCCCGGG.",
		"..CCCCCGGCCCCC..",
		"..CCCCCGGCCCCC..",
		"..CCCCCGGCCCCC..",
		"..CCCCCCCCCCCC..",
		"..GGGGGGGGGGGG..",
		"..CCCCC..CCCCC..",
		"..CCCCC..CCCCC..",
		"..cccc....cccc..",
	] } },
	{ name: "Ragged", part: { y: 11, rows: [
		"....CCCssCCC....",
		"..CCCCCCccCCCCC.",
		"..CCCCCCccCCCCC.",
		"..CCCCCCccCCCCC.",
		"..CCCCCCccCCCCC.",
		"..CCCCCCccCCCCC.",
		"..CCCCCCccCCCCC.",
		".CCCCCCCccCCCCCC",
		".CCCCCCCccCCCCCC",
		".CC.CCC.cc.CCC.C",
		".C...C..c...C..C",
	] } },
	{ name: "Noble", part: { y: 11, rows: [
		"....CCCssCCC....",
		"..CCCCRRRRCCCCC.",
		"..CCCCCRRCCCCCC.",
		"..CCCCCGGCCCCCC.",
		"..CCCCCCCCCCCCC.",
		"..CCCCCGGCCCCCC.",
		"..CCCCCCCCCCCCC.",
		"..CCCCCGGCCCCCC.",
		".CCCCCCCCCCCCCCC",
		".CCCCCCCCCCCCCCC",
		".CCCCCCCCCCCCCCC",
	] } },
	{ name: "Tunic", part: { y: 11, rows: [
		"....CCCssCCC....",
		"...CCCCccCCCC...",
		"..sCCCCCCCCCCs..",
		"..sCCCCCCCCCCs..",
		"..sCCCCCCCCCCs..",
		"...KKKKKKKKKK...",
		"...CCCCCCCCCC...",
		"...CCCCCCCCCC...",
		"...CCCC..CCCC...",
		"...CCCC..CCCC...",
		"...KKKK..KKKK...",
	] } },
];

const ACCESSORIES = [
	{ name: "None", part: null },
	{ name: "Crown", part: { y: 0, rows: [
		".....G.GG.G.....",
		".....GGGGGG.....",
		".....GGRRGG.....",
	] } },
	{ name: "Horns", part: { y: 0, rows: [
		"...P........P...",
		"...PP......PP...",
		"...PP......PP...",
		"....P......P....",
	] } },
	{ name: "Scar", part: { y: 3, rows: [
		".........K......",
		"........K.......",
		".......K........",
	] } },
	{ name: "Monocle", part: { y: 5, rows: [
		".........GG.....",
		"........G..G....",
		".........GG.G...",
		"............G...",
		"............G...",
		"............G...",
	] } },
	{ name: "Hood", part: { y: 1, rows: [
		".....CCCCCC.....",
		"....CCCCCCCC....",
		"...CCCCCCCCCC...",
		"...CCC....CCC...",
		"...CC......CC...",
		"...CC......CC...",
		"...CC......CC...",
		"...CC......CC...",
		"...CCC....CCC...",
	] } },
	{ name: "Eyepatch", part: { y: 4, rows: [
		".....K..........",
		"....KKK.........",
		"....KKK.........",
	] } },
];

// What can be chosen: key -> list of names (for the builder)
export const OPTIONS = {
	skin: NAMES.skin,
	hairStyle: HAIR.map((p) => p.name),
	hairColor: NAMES.hairColor,
	eyes: EYES.map((p) => p.name),
	eyeColor: NAMES.eyeColor,
	mouth: MOUTHS.map((p) => p.name),
	cloak: CLOAKS.map((p) => p.name),
	cloakColor: NAMES.cloakColor,
	accessory: ACCESSORIES.map((p) => p.name),
};

export const LABELS = {
	skin: "Skin", hairStyle: "Hair", hairColor: "Hair colour", eyes: "Eyes", eyeColor: "Eye colour",
	mouth: "Mouth", cloak: "Cloak", cloakColor: "Cloak colour", accessory: "Extra",
};

export const KEYS = Object.keys(OPTIONS);

// ---------- Making and checking avatars ----------
export function normalizeAvatar(value) {
	const avatar = {};
	for (const key of KEYS) {
		const count = OPTIONS[key].length;
		const number = value && Number.isInteger(value[key]) ? value[key] : 0;
		avatar[key] = ((number % count) + count) % count;
	}
	return avatar;
}

export function randomAvatar() {
	const avatar = {};
	for (const key of KEYS) avatar[key] = Math.floor(Math.random() * OPTIONS[key].length);
	return avatar;
}

// The same name always gives the same figure: used for players who have not made one yet
export function defaultAvatar(seed = "") {
	let hash = 2166136261;
	for (const character of String(seed)) hash = Math.imul(hash ^ character.codePointAt(0), 16777619) >>> 0;
	const avatar = {};
	for (const key of KEYS) {
		hash = Math.imul(hash ^ (hash >>> 15), 2246822519) >>> 0;
		avatar[key] = hash % OPTIONS[key].length;
	}
	// A new player should not start with a hood or a crown they did not choose
	avatar.accessory = 0;
	return avatar;
}

// ---------- Drawing ----------
function shade(hex, factor) {
	const n = parseInt(hex.slice(1), 16);
	const channel = (shift) => Math.max(0, Math.min(255, Math.round(((n >> shift) & 255) * factor)));
	return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
}

function palette(avatar) {
	const skin = SKIN_TONES[avatar.skin];
	const hair = HAIR_COLORS[avatar.hairColor];
	const eye = EYE_COLORS[avatar.eyeColor];
	const cloak = CLOAK_COLORS[avatar.cloakColor];
	return {
		S: skin, s: shade(skin, 0.78),
		H: hair, h: shade(hair, 0.65),
		E: eye, g: eye + "66",
		C: cloak, c: shade(cloak, 0.68),
		K: "#17121c", W: "#f4f4f8", T: "#f4f0e6", R: "#b3182a", G: "#e0b43a", P: "#e8e0cc",
	};
}

function paint(context, part, colors) {
	if (!part) return;
	part.rows.forEach((row, rowIndex) => {
		for (let x = 0; x < row.length; x++) {
			const colour = colors[row[x]];
			if (!colour) continue;
			context.fillStyle = colour;
			context.fillRect(x, part.y + rowIndex, 1, 1);
		}
	});
}

// Draws the figure at its real size (16 x 22 pixels); show the canvas bigger with CSS (image-rendering: pixelated).
export function drawAvatar(canvas, value) {
	const avatar = normalizeAvatar(value);
	canvas.width = WIDTH;
	canvas.height = HEIGHT;
	const context = canvas.getContext("2d");
	context.clearRect(0, 0, WIDTH, HEIGHT);
	const colors = palette(avatar);
	paint(context, CLOAKS[avatar.cloak].part, colors);
	paint(context, BASE_HEAD, colors);
	paint(context, EYES[avatar.eyes].part, colors);
	paint(context, MOUTHS[avatar.mouth].part, colors);
	paint(context, HAIR[avatar.hairStyle].part, colors);
	paint(context, ACCESSORIES[avatar.accessory].part, colors);
}

// Banner colours for the character page
export const ACCENTS = ["#8c1325", "#c9a45f", "#4b2a6e", "#1f4d3a", "#1f3560", "#5a3a24", "#6e6e7a", "#b5502a"];
export const ACCENT_NAMES = ["Blood", "Gold", "Violet", "Forest", "Navy", "Earth", "Steel", "Ember"];
