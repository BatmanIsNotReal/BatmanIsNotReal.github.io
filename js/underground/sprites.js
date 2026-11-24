// Monster pictures: a few small ASCII shapes, each painted in the colour of its monster.
// B body colour   b darker body   W white   R red eye   K black
const SHAPES = {
	quadruped: [
		"..........BB..",
		".........BBBBK",
		".BB.....BBBBBR",
		"BBBBBBBBBBBBB.",
		".BBBBBBBBBBBB.",
		"..bB.bB..bB.bB",
		"..b..b....b..b",
	],
	bat: [
		"..............",
		"bb....B..B..bb",
		"bBb..BBBBBB.bBb",
		"bBBbBBRBBRBBbBb",
		".bBBBBBBBBBBBb.",
		"..bbBBBWWBBbb..",
		"....bBB..BBb...",
	].map((row) => row.slice(0, 14).padEnd(14, ".")),
	humanoid: [
		".....BBBB.....",
		"....BBBBBB....",
		"....BRBBRB....",
		"....BBBBBB....",
		".....BWWB.....",
		"...bbBBBBbb...",
		"..bBbBBBBbBb..",
		"..B.bBBBBb.B..",
		"..B.bBBBBb.B..",
		"....bb..bb....",
		"....bb..bb....",
		"...bbb..bbb...",
	],
	ghost: [
		".....BBBB.....",
		"...BBBBBBBB...",
		"..BBBBBBBBBB..",
		"..BBRBBBBRBB..",
		"..BBBBBBBBBB..",
		"..BBBBKKBBBB..",
		"..BBBBBBBBBB..",
		"..BBBBBBBBBB..",
		"..BB.BBBB.BB..",
		"..B...BB...B..",
	],
	brute: [
		"....BBBBBB....",
		"...BBBBBBBB...",
		"...BRBBBBRB...",
		"...BBBWWBBB...",
		"..bBBBBBBBBb..",
		".BBbBBBBBBbBB.",
		"BBB.BBBBBB.BBB",
		"BB..BBBBBB..BB",
		"BB..bBBBBb..BB",
		"....bb..bb....",
		"...bbb..bbb...",
	],
};

function shade(hex, factor) {
	const n = parseInt(hex.slice(1), 16);
	const part = (shift) => Math.max(0, Math.min(255, Math.round(((n >> shift) & 255) * factor)));
	return `rgb(${part(16)},${part(8)},${part(0)})`;
}

const cache = new Map();

// A canvas with the monster at 1 pixel per sprite pixel (the game scales it up)
export function monsterSprite(kind, color) {
	const key = kind + color;
	if (cache.has(key)) return cache.get(key);
	const rows = SHAPES[kind] || SHAPES.humanoid;
	const canvas = document.createElement("canvas");
	canvas.width = 14;
	canvas.height = rows.length;
	const context = canvas.getContext("2d");
	const colors = { B: color, b: shade(color, 0.62), W: "#f2f0e8", R: "#ff3a3a", K: "#140e12" };
	rows.forEach((row, y) => {
		for (let x = 0; x < row.length && x < 14; x++) {
			const fill = colors[row[x]];
			if (!fill) continue;
			context.fillStyle = fill;
			context.fillRect(x, y, 1, 1);
		}
	});
	cache.set(key, canvas);
	return canvas;
}
