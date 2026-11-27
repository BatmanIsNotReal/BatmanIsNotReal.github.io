// The tavern room: its size, the furniture you cannot walk through, and the rules for where a
// character may stand. Used by the server (which decides where everyone stands) and by the browser
// (which draws the room and shows a move straight away, before the server has confirmed it).
// Plain ES module with no browser or Node parts.

export const ROOM = { width: 1600, height: 960 };
export const PLAYER_RADIUS = 22;
export const MIN_GAP = 46;            // two characters cannot stand closer than this
export const SPAWN = { x: 800, y: 880 }; // just inside the door
export const MAX_SAY = 80;            // longest message in a speech bubble
export const SAY_SHOW_MS = 8000;      // how long a sent message stays above a head

// The wall along the top and the edges of the floor
export const FLOOR = { left: 50, right: 1550, top: 205, bottom: 925 };

// Furniture you cannot walk through (rectangles, in room coordinates).
// kind tells the drawing code what to paint there.
// A round table: you cannot walk through the top, but the stools around it are free to stand on.
// (x, y) is the top-left of a 120 x 120 square around it; cx, cy is the middle.
function table(x, y) { return { kind: "table", x: x + 10, y: y + 14, w: 100, h: 92, cx: x + 60, cy: y + 60 }; }

export const FURNITURE = [
	{ kind: "bar", x: 70, y: 190, w: 560, h: 74 },
	table(360, 470),
	table(760, 400),
	table(1160, 470),
	table(520, 740),
	table(1000, 740),
	{ kind: "barrel", x: 1490, y: 250, w: 64, h: 64 },
	{ kind: "barrel", x: 1490, y: 330, w: 64, h: 64 },
	{ kind: "hearth", x: 1180, y: 170, w: 260, h: 50 },
];

// Is a character with its middle at (x, y) clear of the walls and the furniture?
// room: "tavern" (tables, bar and fireplace in the way) or "mansion" (an empty room: you can walk over
// every piece of furniture that is put down)
export function floorFree(x, y, room = "tavern") {
	if (!(x >= FLOOR.left && x <= FLOOR.right && y >= FLOOR.top && y <= FLOOR.bottom)) return false;
	if (room === "mansion") return true;
	for (const f of FURNITURE) {
		const nearestX = Math.max(f.x, Math.min(x, f.x + f.w));
		const nearestY = Math.max(f.y, Math.min(y, f.y + f.h));
		if (Math.hypot(x - nearestX, y - nearestY) < PLAYER_RADIUS) return false;
	}
	return true;
}

// Can a character stand here? others: [{ x, y }] of the characters already in the room.
// Returns "" when the spot is free, or a short reason.
export function spotProblem(x, y, others, room = "tavern") {
	if (!floorFree(x, y, room)) return "You cannot stand there.";
	for (const o of others) if (Math.hypot(x - o.x, y - o.y) < MIN_GAP) return "Somebody is standing there.";
	return "";
}

// A free spot near the door for a newcomer
export function freeSpawn(others, room = "tavern") {
	for (let ring = 0; ring < 12; ring++) {
		for (let i = 0; i < 12; i++) {
			const a = (i / 12) * Math.PI * 2, d = ring * 50;
			const x = SPAWN.x + Math.cos(a) * d, y = SPAWN.y + Math.sin(a) * d * 0.6;
			if (!spotProblem(x, y, others, room)) return { x: Math.round(x), y: Math.round(y) };
		}
	}
	return { x: SPAWN.x, y: SPAWN.y };
}

// The stools (chairs) around the tables. Standing on one lifts you a little.
export const STOOL_OFFSETS = [[-78, 4], [78, 4], [0, 76], [0, -70]];
export const STOOLS = [];
for (const f of FURNITURE) {
	if (f.kind !== "table") continue;
	for (const [dx, dy] of STOOL_OFFSETS) {
		if (f.cy + dy < FLOOR.top + 4) continue;
		STOOLS.push({ x: f.cx + dx, y: f.cy + dy });
	}
}
export const STOOL_SNAP = 28;   // a click this close to a stool puts you on it
export const STOOL_LIFT = 14;   // how far above the floor you stand on a stool

// The stool a character is standing on, if any
export function stoolAt(x, y) {
	for (const s of STOOLS) if (Math.hypot(x - s.x, y - s.y) < 12) return s;
	return null;
}

// A click near a stool lands on the stool itself
export function snapToStool(x, y) {
	for (const s of STOOLS) if (Math.hypot(x - s.x, y - s.y) < STOOL_SNAP) return { x: s.x, y: s.y };
	return { x, y };
}

// ---------- Furniture for the mansion ----------
// Found as a drop when you destroy an enemy outpost. 5 chairs, 5 tables, 3 fireplaces, 5 sofas.
export const MAX_FURNITURE_IN_MANSION = 80;
export const MAX_PER_VISIT_PLAYERS = 40;
export const FURNITURE_TYPES = [
	{ id: "chair1", kind: "chair", name: "Plain wooden chair" },
	{ id: "chair2", kind: "chair", name: "Oak chair" },
	{ id: "chair3", kind: "chair", name: "Red cushioned chair" },
	{ id: "chair4", kind: "chair", name: "Carved dark chair" },
	{ id: "chair5", kind: "chair", name: "Gilded chair" },
	{ id: "table1", kind: "table", name: "Round oak table" },
	{ id: "table2", kind: "table", name: "Square pine table" },
	{ id: "table3", kind: "table", name: "Long dining table" },
	{ id: "table4", kind: "table", name: "Marble-top table" },
	{ id: "table5", kind: "table", name: "Black walnut table" },
	{ id: "fireplace1", kind: "fireplace", name: "Stone hearth" },
	{ id: "fireplace2", kind: "fireplace", name: "Brick fireplace" },
	{ id: "fireplace3", kind: "fireplace", name: "Marble fireplace" },
	{ id: "sofa1", kind: "sofa", name: "Red velvet sofa" },
	{ id: "sofa2", kind: "sofa", name: "Green sofa" },
	{ id: "sofa3", kind: "sofa", name: "Blue sofa" },
	{ id: "sofa4", kind: "sofa", name: "Brown leather sofa" },
	{ id: "sofa5", kind: "sofa", name: "Black and gold sofa" },
];
// Rare pieces: not dropped by outposts, only sold by travelling traders (random event) or traded between players.
const RARE = [
	["rare1", "Brass floor lamp", 3200], ["rare2", "Silver candelabra", 3500], ["rare3", "Grandfather clock", 4200],
	["rare4", "Marble maiden statue", 5200], ["rare5", "Bronze warrior statue", 5600], ["rare6", "Stone gargoyle", 6000],
	["rare7", "Suit of armour", 6400], ["rare8", "Potted palm", 3000], ["rare9", "Grand harp", 7200],
	["rare10", "Globe on a stand", 4800], ["rare11", "Tall bookshelf", 4000], ["rare12", "Blood-red throne", 10000],
	["rare13", "Upright coffin", 8200], ["rare14", "Crystal ball", 7800], ["rare15", "Gilded mirror", 5000],
];
for (const [id, name, price] of RARE) FURNITURE_TYPES.push({ id, kind: "rare", name, price });
export const COMMON_FURNITURE = FURNITURE_TYPES.filter((t) => t.kind !== "rare");

// Backgrounds for a mansion (walls and floor). The owner picks one in the inventory menu; "default" is the plain hall.
// wallA / wallB: the two wall shades, trim: the gold band, panel: the panelling, floor: rgb, sky: the window glass.
export const BACKGROUNDS = [
	{ id: "bg1", name: "Midnight blue hall", price: 3500, wallA: "#1c2a4a", wallB: "#16223e", trim: "#c0c8d8", panel: "#10182c", floor: [70, 78, 104], sky: "#0a1226", style: "stripes", tiles: false },
	{ id: "bg2", name: "Emerald parlour", price: 4200, wallA: "#1e4a34", wallB: "#183c2a", trim: "#d8c070", panel: "#0e2a1c", floor: [112, 78, 52], sky: "#102a38", style: "stripes", tiles: false },
	{ id: "bg3", name: "Old stone keep", price: 5000, wallA: "#5a5a60", wallB: "#4a4a50", trim: "#8a7a5a", panel: "#34343a", floor: [92, 90, 94], sky: "#1a2030", style: "bricks", tiles: true },
	{ id: "bg4", name: "Ivory ballroom", price: 6000, wallA: "#e0d8c4", wallB: "#d4ccb6", trim: "#c9a45f", panel: "#b8ae94", floor: [230, 226, 216], sky: "#7a98c8", style: "plain", tiles: true },
	{ id: "bg5", name: "Black and gold salon", price: 7500, wallA: "#16161a", wallB: "#1e1e24", trim: "#e8c070", panel: "#0a0a0c", floor: [40, 38, 44], sky: "#1a1630", style: "stripes", tiles: true },
	{ id: "bg6", name: "Crimson chapel", price: 6500, wallA: "#7a1020", wallB: "#6a0c1a", trim: "#e8c070", panel: "#3a0810", floor: [96, 56, 44], sky: "#5a1a6a", style: "plain", tiles: false },
	{ id: "bg7", name: "Violet observatory", price: 8000, wallA: "#3a2058", wallB: "#2e184a", trim: "#b0a0e0", panel: "#1c1030", floor: [74, 58, 100], sky: "#06041a", style: "plain", tiles: false },
	{ id: "bg8", name: "Frozen palace", price: 9500, wallA: "#a8c8dc", wallB: "#98bcd2", trim: "#f0f8ff", panel: "#6a90aa", floor: [188, 212, 228], sky: "#c0e0f0", style: "bricks", tiles: true },
];
// everything a player can own (and trade)
export const ITEM_TYPES = [...FURNITURE_TYPES, ...BACKGROUNDS.map((b) => ({ id: b.id, kind: "background", name: b.name + " (background)", price: b.price }))];
export const SHOP_ITEMS = ITEM_TYPES.filter((t) => t.price);
export function furnitureType(id) {
	return FURNITURE_TYPES.find((t) => t.id === id) || null;
}
export function itemType(id) {
	return ITEM_TYPES.find((t) => t.id === id) || null;
}
export function backgroundType(id) {
	return BACKGROUNDS.find((t) => t.id === id) || null;
}
