// Trade routes: roads from the bazaar to the edge of the map.
// Plain ES module with no browser parts, so it can be tested in Node.
//
// A route in one direction (north, east, south or west) exists when an unbroken line of road tiles runs
// from the bazaar to a tile on that edge of the map. The first road tile has to touch the bazaar.
// Defence buildings (watch tower, guard outpost, fort) count as part of the road, so they can stand
// directly on it: those protect the route the most.
//
// Income per round (10 seconds), per open route:
//     BASE_INCOME x (1 + neighbours + length + safety)
//   neighbours: +1% for each hut, mine, lumber mill and tavern among the 24 nearest tiles of the bazaar
//   length:     +1% for each tile of the route (a long road pays more, but costs more to build)
//   safety:     defences beside the route (see SAFETY)
// A route is blocked, and pays nothing, while a raiding outpost stands within BLOCK_RANGE tiles of it.

export const TILE_ROAD = 17;
export const TILE_BAZAAR = 18;
export const BASE_INCOME = 10;
export const NEIGHBOUR_BONUS = 0.01;
export const LENGTH_BONUS = 0.01;
export const BLOCK_RANGE = 5;
export const MAX_SAFETY = 0.5;

const PASSABLE = new Set([TILE_ROAD, 10, 11, 12]);          // road, watch tower, guard outpost, fort
const NEIGHBOUR_TILES = new Set([1, 4, 7, 15]);             // hut, mine, lumber mill, tavern
const SAFETY = { 10: 0.01, 11: 0.03, 12: 0.06 };            // what each kind of defence adds
const OUTPOST = 13;
export const DIRECTIONS = ["north", "east", "south", "west"];

// How much of a defence's bonus counts, by how far it is from the road (in tiles)
function nearness(distance) {
	if (distance <= 0) return 1;      // on the road itself
	if (distance <= 2) return 0.6;
	if (distance <= 5) return 0.3;
	return 0;
}

// tileAt(x, y) -> tile type number; width and height of the map
export function analyseTrade(tileAt, width, height) {
	let bazaar = null;
	const outposts = [], defences = [];
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const t = tileAt(x, y);
			if (t === TILE_BAZAAR && !bazaar) bazaar = { x, y };
			else if (t === OUTPOST) outposts.push({ x, y });
			else if (SAFETY[t]) defences.push({ x, y, type: t });
		}
	}
	const result = { bazaar, routes: [], neighbourBonus: 0, neighbours: 0, base: BASE_INCOME, income: 0 };
	if (!bazaar) return result;

	// The 24 nearest tiles (5 x 5 around the bazaar): each hut, mine, lumber mill or tavern adds 1%
	for (let dy = -2; dy <= 2; dy++) {
		for (let dx = -2; dx <= 2; dx++) {
			if (!dx && !dy) continue;
			const x = bazaar.x + dx, y = bazaar.y + dy;
			if (x < 0 || y < 0 || x >= width || y >= height) continue;
			if (NEIGHBOUR_TILES.has(tileAt(x, y))) result.neighbours++;
		}
	}
	result.neighbourBonus = result.neighbours * NEIGHBOUR_BONUS;

	// Walk along the road from the bazaar (breadth first: the first time we reach a tile is the shortest way)
	const key = (x, y) => y * width + x;
	const parent = new Map(), dist = new Map();
	const queue = [];
	for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
		const x = bazaar.x + dx, y = bazaar.y + dy;
		if (x < 0 || y < 0 || x >= width || y >= height || !PASSABLE.has(tileAt(x, y))) continue;
		parent.set(key(x, y), -1); dist.set(key(x, y), 1); queue.push({ x, y });
	}
	for (let i = 0; i < queue.length; i++) {
		const { x, y } = queue[i];
		for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
			const nx = x + dx, ny = y + dy;
			if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
			const k = key(nx, ny);
			if (parent.has(k) || !PASSABLE.has(tileAt(nx, ny))) continue;
			parent.set(k, key(x, y)); dist.set(k, dist.get(key(x, y)) + 1);
			queue.push({ x: nx, y: ny });
		}
	}

	const edgeTiles = {
		north: (x, y) => y === 0, south: (x, y) => y === height - 1,
		west: (x, y) => x === 0, east: (x, y) => x === width - 1,
	};
	for (const dir of DIRECTIONS) {
		const route = { dir, open: false, length: 0, blocked: false, safety: 0, defences: 0, multiplier: 1, income: 0, path: [] };
		let best = null;
		for (const { x, y } of queue) if (edgeTiles[dir](x, y) && (!best || dist.get(key(x, y)) < dist.get(key(best.x, best.y)))) best = { x, y };
		if (best) {
			route.open = true;
			route.length = dist.get(key(best.x, best.y));
			for (let k = key(best.x, best.y); k !== -1; k = parent.get(k)) route.path.push({ x: k % width, y: Math.floor(k / width) });
			route.path.reverse();
			// raiders close to the road block it
			route.blocked = outposts.some((o) => route.path.some((p) => Math.max(Math.abs(p.x - o.x), Math.abs(p.y - o.y)) <= BLOCK_RANGE));
			// defences next to the road make it safer
			for (const d of defences) {
				const away = Math.min(...route.path.map((p) => Math.max(Math.abs(p.x - d.x), Math.abs(p.y - d.y))));
				const share = nearness(away);
				if (share > 0) { route.safety += SAFETY[d.type] * share; route.defences++; }
			}
			route.safety = Math.min(route.safety, MAX_SAFETY);
			route.multiplier = 1 + result.neighbourBonus + route.length * LENGTH_BONUS + route.safety;
			route.income = route.blocked ? 0 : BASE_INCOME * route.multiplier;
		}
		result.routes.push(route);
		result.income += route.income;
	}
	return result;
}
