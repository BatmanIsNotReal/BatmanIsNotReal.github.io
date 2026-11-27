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
export function furnitureType(id) {
	return FURNITURE_TYPES.find((t) => t.id === id) || null;
}
