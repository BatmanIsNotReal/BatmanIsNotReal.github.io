// The vampire character: a small pixel-art figure built from freely combined parts.
// An avatar is just a few numbers (which hair, which cloak, which colours ...), so it is tiny to
// save and send. drawAvatar() paints it on a canvas, layer by layer.
//
// Each part is a picture of 16 characters per row. A letter is a colour role, "." is see-through:
//   S skin   s skin (shadow)   H hair   h hair (dark)   E eye colour   g eye glow
//   C cloak  c cloak (dark)    K black  W white  T tooth  R blood red  G gold  P bone

import { choiceAllowed } from "../rules.mjs";

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


// ---------- Hair and robes found in the underground (one hair and one robe for each dungeon) ----------
// They use the player's own hair and cloak colours; F f V D r O M m are fixed extra colours (see HELMET_COLORS).
const LOOT_HAIR = [
	{ name: "Tangled mop", loot: 1, part: { y: 1, rows: [
		"....H..HH..H....",
		".....HHHHHHH....",
		"....HHHHHHHHH...",
		"....HhHHHHhHH...",
		"...HH.H..H.HH...",
		"...H........H...",
	] } },
	{ name: "Ponytail", loot: 2, part: { y: 2, rows: [
		".....HHHHHH.....",
		"....HHHHHHHH....",
		"....HH....HHH...",
		"..........HHH...",
		"..........HHh...",
		"...........Hh...",
		"...........hH...",
		"............H...",
	] } },
	{ name: "Warrior braids", loot: 3, part: { y: 2, rows: [
		".....HHHHHH.....",
		"....HHHHHHHH....",
		"...HHHH..HHHH...",
		"...HHH....HHH...",
		"...Hh......hH...",
		"...hH......Hh...",
		"...Hh......hH...",
		"...hH......Hh...",
		"....H......H....",
	] } },
	{ name: "Flame crest", loot: 4, part: { y: 0, rows: [
		".....F..F..F....",
		".....FF.FF.FF...",
		"....fFFFFFFFf...",
		"....HHFFFFHH....",
		"....HHHHHHHH....",
		"....Hh....hH....",
	] } },
	{ name: "Shadow mane", loot: 5, part: { y: 2, rows: [
		".....HHHHHH.....",
		"....HHHHHHHH....",
		"...HHHH..HHHH...",
		"..HHHHH..HHHHH..",
		"..HHHH....HHHH..",
		"..HHH......HHH..",
		"..HHH......HHH..",
		"..HHh......hHH..",
		"..HVh......hVH..",
		"..VV........VV..",
		"..V..........V..",
	] } },
];

const LOOT_ROBES = [
	{ name: "Rat-pelt cloak", loot: 1, part: { y: 11, rows: [
		"....CCCssCCC....",
		".PPPCCCCCCCCPPP.",
		".PPPCCCccCCCPPP.",
		"..CCCCCccCCCCC..",
		"..CCCCCccCCCCC..",
		"..CCCCCccCCCCC..",
		"..CCCCCccCCCCCC.",
		".CCCCCCccCCCCCC.",
		".CCPCCCccCCCPCC.",
		".CCCCCCccCCCCCC.",
		".CC.CCCccCCC.CC.",
	] } },
	{ name: "Bone-plate robe", loot: 2, part: { y: 11, rows: [
		"....CCCssCCC....",
		"..CCCPPPPPPCCC..",
		"..CCPPPPPPPPCC..",
		"..CCCPPPPPPCCC..",
		"..CCPPPPPPPPCC..",
		"..CCCPPPPPPCCC..",
		"..CCCCCccCCCCC..",
		"..CCCCCccCCCCC..",
		".CCCCCCccCCCCCC.",
		".CCCCCCccCCCCCC.",
		".CCCCCCccCCCCCC.",
	] } },
	{ name: "Crimson vestments", loot: 3, part: { y: 11, rows: [
		"....CCCssCCC....",
		"..CCCCRRRRCCCCC.",
		"..CCCCRGGRCCCCC.",
		"..CCCCCRRCCCCCC.",
		"..CCCCCRRCCCCCC.",
		"..CCCCCRRCCCCCC.",
		"..CCCCCRRCCCCCC.",
		".CCCCCCRRCCCCCC.",
		".CCCCCCRRCCCCCC.",
		".CCCCCCRRCCCCCC.",
		".RRRRRRRRRRRRRR.",
	] } },
	{ name: "Ember mantle", loot: 4, part: { y: 11, rows: [
		"....CCCssCCC....",
		".FFFCCCCCCCCFFF.",
		".fFFCCCccCCCFFf.",
		"..CCCCCccCCCCC..",
		"..CCCCCccCCCCC..",
		"..CCCCCccCCCCC..",
		"..CCCCCccCCCCC..",
		".CCCCCCccCCCCCC.",
		".CCCCCCccCCCCCC.",
		".CfCfCCccCCfCfC.",
		".FfFfFFFFFFfFfF.",
	] } },
	{ name: "Black Throne regalia", loot: 5, part: { y: 11, rows: [
		"...G.CCssCC.G...",
		"..GGCCCCCCCCGG..",
		"..VVCCCGGCCCVV..",
		"..CCCCCGGCCCCC..",
		"..CCCCCCCCCCCC..",
		"..CCVCCCCCCVCC..",
		"..CCCCCVVCCCCC..",
		".CCCCCCVVCCCCCC.",
		".CCCCCCVVCCCCCC.",
		".VCCCCCVVCCCCCV.",
		".VVVVVVVVVVVVVV.",
	] } },
];

// How many hair styles and robes everybody can pick from the start; the found ones come after them
export const BASE_COUNT = { hairStyle: HAIR.length, cloak: CLOAKS.length, weapon: 1 };
HAIR.push(...LOOT_HAIR);
CLOAKS.push(...LOOT_ROBES);

// ---------- Shirts, armour and weapons (found in the underground) ----------
const SHIRT_BASE = [
	"...CCCCssCCCC...",
	"..CCCCCCCCCCCC..",
	".CCCCCCCCCCCCCC.",
	".CCCCCCCCCCCCCC.",
	".SSCCCCCCCCCCSS.",
	".SSCCCCCCCCCCSS.",
	".SS.CCCCCCCC.SS.",
	".SS.CCCCCCCC.SS.",
	"....CCCCCCCC....",
	"....CCCCCCCC....",
	"....CCCCCCCC....",
];
const setAt = (row, x, text) => row.slice(0, x) + text + row.slice(x + text.length);
const SHIRTS = [
	{ name: "Plain shirt", part: { y: 11, rows: SHIRT_BASE } },
	{ name: "Striped shirt", part: { y: 11, rows: SHIRT_BASE.map((row, i) => (i % 2 ? row.replace(/C/g, "P") : row)) } },
	{ name: "Laced shirt", part: { y: 11, rows: SHIRT_BASE.map((row, i) => (i < 5 ? setAt(row, 7, ["ss", "sO", "Os", "sO", "Os"][i]) : row)) } },
	{ name: "Squire's vest", part: { y: 11, rows: [
		"...PPPPssPPPP...",
		"..PPPCCssCCPPP..",
		".PPPCCCccCCCPPP.",
		".PPPCCCccCCCPPP.",
		".PPPCCCccCCCPPP.",
		".PPPCCCccCCCPPP.",
		".PP.CCCccCCC.PP.",
		".SS.CCCccCCC.SS.",
		"....CCCccCCC....",
		"....CCCccCCC....",
		"....CCCccCCC....",
	] } },
];
const ARMOR_TEMPLATE = [
	"...AAAAssAAAA...",
	".aAAAAAAAAAAAAa.",
	"aAALAAAaaAAALAAa",
	"aAAAAAAaaAAAAAAa",
	".aAAAAAaaAAAAAa.",
	".aAAAAAaaAAAAAa.",
	"..aAAAAaaAAAAa..",
	"..aAAAAaaAAAAa..",
	"..aGGGGGGGGGGa..",
	"..AAAAAaaAAAAA..",
	"..AAAAAaaAAAAA..",
];
const armor = (name, A, a, L) => ({ name, colors: { A, a, L }, part: { y: 11, rows: ARMOR_TEMPLATE } });
const ARMORS = [
	armor("Bronze armour", "#c88a3a", "#7a4c1a", "#f0c070"),
	armor("Blue armour", "#3d6fcf", "#1f3a7a", "#8fb8ff"),
	armor("Green armour", "#3a9a52", "#1d5a2c", "#8fe0a0"),
	armor("Red armour", "#c42a3a", "#6e0f1a", "#ff8a96"),
];
CLOAKS.push(...SHIRTS, ...ARMORS);

// Weapons are held at the right side. Letters: w n wood  B b blade  Q q crystal  R r blood orb  G gold  F f flame
const right = (text) => text.padStart(16, ".");
const staff = (head, colors) => {
	const y = 1, rows = head.map(right);
	while (y + rows.length < HEIGHT) rows.push(right("wn"));
	return { y, rows, colors };
};
const sword = (blade, tip, guard, colors) => {
	const rows = [right(tip), ...Array(9).fill(right(blade)), right(guard), right("wn"), right("wn"), right("GG")];
	return { y: 3, rows, colors };
};
const WOOD = { w: "#8a5a30", n: "#4e3119" };
const WEAPONS = [
	{ name: "None", part: null },
	{ name: "Oak staff", part: staff(["w.w.", "www.", "wn"], WOOD) },
	{ name: "Iron sword", part: sword("Bb", "B.", "GGGG", { ...WOOD, B: "#d6dcea", b: "#8e96aa" }) },
	{ name: "Crystal staff", part: staff(["Q.", "QQQ", "QqQ", "Q."], { ...WOOD, Q: "#5ad7ff", q: "#1f8fc0" }) },
	{ name: "Silver sword", part: sword("BBb", "BB.", "GGGGG", { ...WOOD, B: "#eef6ff", b: "#9ab7d8" }) },
	{ name: "Blood staff", part: staff(["R.", "RRR", "RrR", "R."], { ...WOOD, R: "#d02a3a", r: "#5c0f1a" }) },
	{ name: "Flame sword", part: sword("BBb", "F.", "GGGGG", { ...WOOD, B: "#ffb43c", b: "#d4541c", F: "#ff6a1c" }) },
];

// Which choice numbers a player may use: the ones everybody has plus the found ones (owned = dungeon numbers)
export function allowedChoices(key, owned = {}) {
	const list = [];
	for (let i = 0; i < OPTIONS[key].length; i++) if (choiceAllowed(key, i, owned)) list.push(i);
	return list;
}

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
	weapon: WEAPONS.map((p) => p.name),
};

export const LABELS = {
	skin: "Skin", hairStyle: "Hair", hairColor: "Hair colour", eyes: "Eyes", eyeColor: "Eye colour",
	mouth: "Mouth", cloak: "Clothes", cloakColor: "Clothes colour", accessory: "Extra", weapon: "Weapon",
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
	for (const key of KEYS) avatar[key] = Math.floor(Math.random() * (BASE_COUNT[key] || OPTIONS[key].length));
	return avatar;
}

// The same name always gives the same figure: used for players who have not made one yet
export function defaultAvatar(seed = "") {
	let hash = 2166136261;
	for (const character of String(seed)) hash = Math.imul(hash ^ character.codePointAt(0), 16777619) >>> 0;
	const avatar = {};
	for (const key of KEYS) {
		hash = Math.imul(hash ^ (hash >>> 15), 2246822519) >>> 0;
		avatar[key] = hash % (BASE_COUNT[key] || OPTIONS[key].length);
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


// ---------- Helmets (found in the underground, one for each level) ----------
// Drawn over the head. Their own colours: M metal  m dark metal  F flame  f ember  D shadow  V violet  r dark red
const HELMET_COLORS = { M: "#9aa0ae", m: "#4c505c", F: "#f39a2c", f: "#c4381c", D: "#241a30", V: "#9a4ad0", r: "#5c0f1a", O: "#f0e6c8" };
export const HELMETS = [
	{ name: "None", part: null },
	{ name: "Gnawed Rat Skull", part: { y: 1, rows: [
		".....PPPPPP.....",
		"....PPPPPPPP....",
		"....PKPPPPKP....",
		"....PPPKKPPP....",
		"....P.PPPP.P....",
	] } },
	{ name: "Bone Crown", part: { y: 0, rows: [
		"....P..PP..P....",
		"....PP.PP.PP....",
		"....PPPPPPPP....",
		"....GPPGGPPG....",
		"....PPPPPPPP....",
	] } },
	{ name: "Crimson Cowl", part: { y: 2, rows: [
		".....RRRRRR.....",
		"....RRRRRRRR....",
		"...RRRRRRRRRR...",
		"...RRr....rRR...",
		"...RR......RR...",
		"...Rr......rR...",
		"...Rr......rR...",
	] } },
	{ name: "Molten Horns", part: { y: 0, rows: [
		"..F..........F..",
		"..FF........FF..",
		"..fFF......FFf..",
		"...fFmmmmmmFf...",
		"....mmMMMMmm....",
		"....mMMMMMMm....",
		"....mm....mm....",
	] } },
	{ name: "Helm of the Black Throne", part: { y: 1, rows: [
		"......GGGG......",
		".....GGVVGG.....",
		"....DDDVVDDD....",
		"...DDDDDDDDDD...",
		"...DmDDDDDDmD...",
		"...Dm......mD...",
		"...Dm......mD...",
	] } },
];
export const HELMET_COUNT = HELMETS.length - 1;

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
export function drawAvatar(canvas, value, helmet = 0) {
	const avatar = normalizeAvatar(value);
	canvas.width = WIDTH;
	canvas.height = HEIGHT;
	const context = canvas.getContext("2d");
	context.clearRect(0, 0, WIDTH, HEIGHT);
	const colors = palette(avatar);
	const extra = { ...colors, ...HELMET_COLORS };
	paint(context, CLOAKS[avatar.cloak].part, { ...extra, ...CLOAKS[avatar.cloak].colors });
	paint(context, BASE_HEAD, colors);
	paint(context, EYES[avatar.eyes].part, colors);
	paint(context, MOUTHS[avatar.mouth].part, colors);
	paint(context, HAIR[avatar.hairStyle].part, extra);
	paint(context, ACCESSORIES[avatar.accessory].part, colors);
	const weapon = WEAPONS[avatar.weapon];
	if (weapon.part) paint(context, weapon.part, { ...colors, ...weapon.part.colors });
	if (HELMETS[helmet] && HELMETS[helmet].part) paint(context, HELMETS[helmet].part, { ...colors, ...HELMET_COLORS });
}

// Banner colours for the character page
export const ACCENTS = ["#8c1325", "#c9a45f", "#4b2a6e", "#1f4d3a", "#1f3560", "#5a3a24", "#6e6e7a", "#b5502a"];
export const ACCENT_NAMES = ["Blood", "Gold", "Violet", "Forest", "Navy", "Earth", "Steel", "Ember"];
