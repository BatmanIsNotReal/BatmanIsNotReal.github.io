// Little familiars walking around the map, each one near the building it works at.
//   food gatherers -> farms      wood gatherers -> lumber mills     blood gatherers -> blood temples
//   miners -> mines              idle familiars -> huts
// One figure stands for 10 familiars (at most 60 figures), so the crowd grows as the settlement does.
// The figures are only decoration: they sit on a see-through layer over the map and ignore clicks.
//
// Used by the game window (main.js) and the pop-out map (map.html). Both give it a function
// that answers: { width, height, tiles: {tile id: tile type}, counts: {food, wood, blood, mine, idle}, total }.

const FAMILIARS_PER_FIGURE = 10;
const MAX_FIGURES = 60;
const WALK_RADIUS = 2.5; // tiles away from the building
const SYNC_MS = 2000;
const STEP_MS = 300;

// Tile types of the map
const HUT = 1, WATER = 2, ROCK = 3, MINE = 4, FARM = 5, LUMBER_MILL = 7, TEMPLE = 8;
const HOME_TYPE = { food: FARM, wood: LUMBER_MILL, blood: TEMPLE, mine: MINE, idle: HUT };
const JOBS = Object.keys(HOME_TYPE);
const COATS = { food: "#d9b44a", wood: "#8a5a2b", blood: "#b3182a", mine: "#6f7f93", idle: "#8d8799" };

// The picture of one figure (5 x 8 pixels), as an SVG so it stays sharp at any zoom
function figureImage(coat) {
	const rect = (x, y, w, h, fill) => `<rect x='${x}' y='${y}' width='${w}' height='${h}' fill='${fill}'/>`;
	const svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 5 8' shape-rendering='crispEdges'>"
		+ rect(1, 0, 3, 1, "#2a1c14") + rect(1, 1, 3, 2, "#f0d2b8") + rect(1, 1, 1, 1, "#2a1c14")
		+ rect(0, 3, 5, 3, coat) + rect(2, 3, 1, 3, "rgba(0,0,0,.25)")
		+ rect(1, 6, 1, 2, "#1d1520") + rect(3, 6, 1, 2, "#1d1520") + "</svg>";
	return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export default class FamiliarWalkers {
	// stage: the element the map table sits in (position: relative). getState: see above.
	constructor(stage, getState) {
		this.getState = getState;
		this.walkers = [];
		this.signature = "";
		if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

		this.layer = document.createElement("div");
		this.layer.className = "familiar-layer";
		this.layer.setAttribute("aria-hidden", "true");
		for (const job of JOBS) this.layer.style.setProperty("--familiar-" + job, figureImage(COATS[job]));
		stage.appendChild(this.layer);

		this.sync();
		setInterval(() => this.sync(), SYNC_MS);
		setInterval(() => this.step(), STEP_MS);
	}

	// How many figures each job gets: shares of the figure total, rounded so they add up exactly
	shares(state) {
		const counts = JOBS.map((job) => Math.max(0, state.counts[job] || 0));
		const sum = counts.reduce((a, b) => a + b, 0);
		const figures = Math.min(MAX_FIGURES, Math.ceil(Math.max(state.total || sum, 0) / FAMILIARS_PER_FIGURE));
		if (!sum || !figures) return Object.fromEntries(JOBS.map((job) => [job, 0]));
		const exact = counts.map((count) => (count / sum) * figures);
		const result = exact.map(Math.floor);
		let left = figures - result.reduce((a, b) => a + b, 0);
		exact.map((value, index) => [value - Math.floor(value), index]).sort((a, b) => b[0] - a[0])
			.forEach(([, index]) => { if (left-- > 0) result[index]++; });
		return Object.fromEntries(JOBS.map((job, index) => [job, result[index]]));
	}

	// Where the buildings are, and what can be walked on
	readMap(state) {
		const { width, tiles } = state;
		const buildings = Object.fromEntries(JOBS.map((job) => [job, []]));
		const walkable = new Set();
		for (const id in tiles) {
			const index = Number(id.slice(4));
			const type = tiles[id];
			const spot = { x: index % width, y: Math.floor(index / width) };
			if (type !== WATER && type !== ROCK) walkable.add(index);
			for (const job of JOBS) if (type === HOME_TYPE[job]) buildings[job].push(spot);
		}
		return { buildings, walkable, width, height: state.height };
	}

	homeFor(job, number, map) {
		// A farm gets food gatherers, and so on. Without such a building: huts, then any building.
		const options = [map.buildings[job], map.buildings.idle, ...JOBS.map((other) => map.buildings[other])];
		const list = options.find((spots) => spots.length > 0);
		return list ? list[number % list.length] : null;
	}

	sync() {
		let state;
		try { state = this.getState(); } catch { return; }
		if (!state || !state.tiles) return;
		const map = (this.map = this.readMap(state));
		const shares = this.shares(state);

		// Remove surplus figures, add missing ones
		for (const job of JOBS) {
			const mine = this.walkers.filter((walker) => walker.job === job);
			for (const walker of mine.slice(shares[job])) {
				walker.element.remove();
				this.walkers.splice(this.walkers.indexOf(walker), 1);
			}
			for (let i = mine.length; i < shares[job]; i++) this.walkers.push(this.create(job));
		}

		// Spread each job over its buildings; a figure whose building changed appears at the new one
		for (const job of JOBS) {
			this.walkers.filter((walker) => walker.job === job).forEach((walker, number) => {
				const home = this.homeFor(job, number, map);
				if (!home) { walker.home = null; walker.element.style.display = "none"; return; }
				walker.element.style.display = "";
				if (!walker.home || walker.home.x !== home.x || walker.home.y !== home.y) {
					walker.home = home;
					this.place(walker, home.x + 0.3 + Math.random() * 0.4, home.y + 0.5 + Math.random() * 0.3, false);
				}
			});
		}
	}

	create(job) {
		const element = document.createElement("div");
		element.className = "familiar";
		element.style.setProperty("--figure", `var(--familiar-${job})`);
		element.appendChild(document.createElement("i"));
		this.layer.appendChild(element);
		return { element, job, home: null, x: 0, y: 0, nextMove: Date.now() + Math.random() * 2000 };
	}

	place(walker, x, y, animate, seconds = 0) {
		const { element } = walker;
		// Percent of the map, not pixels: zooming changes the tile size but must not make anyone move
		element.style.transition = animate ? `left ${seconds}s linear, top ${seconds}s linear` : "none";
		element.style.left = ((x / this.map.width) * 100).toFixed(3) + "%";
		element.style.top = ((y / this.map.height) * 100).toFixed(3) + "%";
		element.firstChild.style.transform = x < walker.x && animate ? "scaleX(-1)" : "";
		walker.x = x;
		walker.y = y;
	}

	isWalkable(map, x, y) {
		return x >= 0 && y >= 0 && x < map.width && y < map.height && map.walkable.has(Math.floor(y) * map.width + Math.floor(x));
	}

	// Every so often a figure picks a spot near its building and walks there in a straight line
	step() {
		const map = this.map;
		if (!map || document.hidden) return;
		const now = Date.now();
		for (const walker of this.walkers) {
			if (!walker.home || now < walker.nextMove) continue;
			let target = null;
			for (let attempt = 0; attempt < 6 && !target; attempt++) {
				const x = walker.home.x + 0.5 + (Math.random() * 2 - 1) * WALK_RADIUS;
				const y = walker.home.y + 0.5 + (Math.random() * 2 - 1) * WALK_RADIUS;
				// the whole way must be on land
				let clear = true;
				for (let t = 0; t <= 1 && clear; t += 0.25) clear = this.isWalkable(map, walker.x + (x - walker.x) * t, walker.y + (y - walker.y) * t);
				if (clear) target = { x, y };
			}
			if (!target) { walker.nextMove = now + 1000; continue; }
			const distance = Math.hypot(target.x - walker.x, target.y - walker.y);
			const seconds = Math.max(0.6, distance / 0.6); // about 0.6 tiles per second
			this.place(walker, target.x, target.y, true, seconds);
			walker.nextMove = now + seconds * 1000 + 500 + Math.random() * 3000; // rest a moment
		}
	}
}
