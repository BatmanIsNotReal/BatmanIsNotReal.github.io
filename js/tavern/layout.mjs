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
export const FURNITURE = [
	{ kind: "bar", x: 70, y: 190, w: 560, h: 74 },
	{ kind: "table", x: 360, y: 470, w: 120, h: 120 },
	{ kind: "table", x: 760, y: 400, w: 120, h: 120 },
	{ kind: "table", x: 1160, y: 470, w: 120, h: 120 },
	{ kind: "table", x: 520, y: 740, w: 120, h: 120 },
	{ kind: "table", x: 1000, y: 740, w: 120, h: 120 },
	{ kind: "barrel", x: 1490, y: 250, w: 64, h: 64 },
	{ kind: "barrel", x: 1490, y: 330, w: 64, h: 64 },
	{ kind: "hearth", x: 1180, y: 170, w: 260, h: 50 },
];

// Is a character with its middle at (x, y) clear of the walls and the furniture?
export function floorFree(x, y) {
	if (!(x >= FLOOR.left && x <= FLOOR.right && y >= FLOOR.top && y <= FLOOR.bottom)) return false;
	for (const f of FURNITURE) {
		const nearestX = Math.max(f.x, Math.min(x, f.x + f.w));
		const nearestY = Math.max(f.y, Math.min(y, f.y + f.h));
		if (Math.hypot(x - nearestX, y - nearestY) < PLAYER_RADIUS) return false;
	}
	return true;
}

// Can a character stand here? others: [{ x, y }] of the characters already in the room.
// Returns "" when the spot is free, or a short reason.
export function spotProblem(x, y, others) {
	if (!floorFree(x, y)) return "You cannot stand there.";
	for (const o of others) if (Math.hypot(x - o.x, y - o.y) < MIN_GAP) return "Somebody is standing there.";
	return "";
}

// A free spot near the door for a newcomer
export function freeSpawn(others) {
	for (let ring = 0; ring < 12; ring++) {
		for (let i = 0; i < 12; i++) {
			const a = (i / 12) * Math.PI * 2, d = ring * 50;
			const x = SPAWN.x + Math.cos(a) * d, y = SPAWN.y + Math.sin(a) * d * 0.6;
			if (!spotProblem(x, y, others)) return { x: Math.round(x), y: Math.round(y) };
		}
	}
	return { x: SPAWN.x, y: SPAWN.y };
}
