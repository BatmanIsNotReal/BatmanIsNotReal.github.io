// The rules of the war: pure numbers, no page and no saved state, so they can be tested alone.
// Everything is measured in "power". All the numbers here are first guesses, meant to be tuned.

// One round is 10 seconds. Times below are in rounds.
export const MARCH_ROUNDS = 18;          // how long a raid takes to arrive (3 minutes)
export const FORT_RADIUS = 8;            // tiles around a fort that it protects
export const STRENGTH_FLOOR_LEVEL = 5;   // no outposts before this player level
export const GRACE_ROUNDS = 30;          // the first outpost appears this long after the conditions are met

// What each of your units is worth in a battle (the stronger the vampire, the more)
export const UNIT_POWER = {
	mosquito: 1, vampireRat: 2, vampireBat: 3, bloodHound: 8, vampireSlave: 20, nightWalker: 50,
	badabook: 120, draugr: 300, strigoi: 700, vampireMaster: 1800, vampireElder: 4500, bloodDemon: 11000, bloodLeviathan: 27000,
};

// Raids come about twice as often as they used to: roughly every 5 to 14 minutes per outpost
export const FACTIONS = {
	bandits: { name: "the Ashen Road Bandits", mult: 1.0, every: [30, 55], what: "a band of organised bandits" },
	nest: { name: "the Gnarlmaw Nest", mult: 1.25, every: [40, 70], what: "a nest of foul monsters" },
	clan: { name: "the Clan of the Pale Moon", mult: 1.6, every: [50, 85], what: "a rival vampire clan" },
};

// What an outpost is for. Every outpost has one purpose, and they differ in strength.
export const PURPOSES = {
	conquest: { label: "war camp", strengthMul: 1.0, goal: "takes your buildings" },
	thieves: { label: "slavers' camp", strengthMul: 0.55, goal: "steals your familiars" },
	plunder: { label: "plunderers' camp", strengthMul: 0.8, goal: "steals your resources" },
	route: { label: "highwaymen's camp", strengthMul: 0.7, goal: "raids your trade routes" },
};
export const MAX_RAIDS = 3;              // raids on the march at the same time
export const ROUTE_BLOCK_ROUNDS = 30;    // how long a raided trade route pays nothing (5 minutes)

// Tile types of the war
export const TILE = { WATCH_TOWER: 10, GUARD_OUTPOST: 11, FORT: 12, OUTPOST: 13, HELD: 14 };

// What a defence building adds when it is attacked, as a share of baseStrength(level)
export const GARRISON = { [TILE.WATCH_TOWER]: 0.15, [TILE.GUARD_OUTPOST]: 0.35, [TILE.FORT]: 1.0 };

// The strength an average raid party has at a given player level
export const baseStrength = (level) => 12 * Math.pow(1.5, Math.max(0, Math.min(level, 40) - STRENGTH_FLOOR_LEVEL));

export function maxOutposts(level) {
	return level >= 22 ? 6 : level >= 16 ? 5 : level >= 12 ? 4 : level >= 8 ? 3 : level >= 5 ? 2 : 1;
}

// The full strength of an outpost (it grows a little with every raid it sends)
export const outpostCap = (level, faction, raids = 0, purpose = "conquest", jitter = 1) =>
	baseStrength(level) * FACTIONS[faction].mult * (PURPOSES[purpose] ? PURPOSES[purpose].strengthMul : 1) * jitter * (1 + 0.05 * Math.min(raids, 20));

// Guard outposts: each one weakens the raiders a little, and can turn a raid back before it leaves
export const guardPenalty = (guards) => Math.max(0.7, 1 - 0.05 * guards);
export const guardCancelChance = (guards) => 1 - Math.pow(0.8, guards);

// Watch towers: how many rounds before the arrival you hear about a raid. 0 = no warning at all.
export const warnLead = (towers) => (towers <= 0 ? 0 : Math.min(MARCH_ROUNDS, 6 + 3 * (towers - 1)));

// A fight. Both sides roll +-15%. The winner loses a little, the loser a lot.
// rand: a function giving numbers from 0 to 1.
export function resolveBattle(attack, defence, rand = Math.random) {
	const a = attack * (0.85 + 0.3 * rand());
	const d = defence * (0.85 + 0.3 * rand());
	const total = Math.max(1e-9, a + d);
	const attackerWins = a > d;
	const winnerLoss = Math.min(0.5, (0.5 * (attackerWins ? d : a)) / total);
	const loserLoss = Math.min(0.9, 0.15 + (0.6 * (attackerWins ? a : d)) / total);
	return {
		attackerWins,
		attackerLoss: attackerWins ? winnerLoss : loserLoss,
		defenderLoss: attackerWins ? loserLoss : winnerLoss,
		attackRoll: a, defenceRoll: d,
	};
}

// How many of n units die at a given loss rate (a fraction of a unit is a chance)
export const unitsLost = (n, rate, rand = Math.random) => Math.min(n, Math.floor(n * rate + rand()));

// A rough size shown to the player: exact with a watch tower, otherwise a range
export function describeStrength(strength, hasTower) {
	const round = (v) => {
		const digits = Math.pow(10, Math.max(0, Math.floor(Math.log10(Math.max(1, v))) - 1));
		return Math.max(1, Math.round(v / digits) * digits);
	};
	return hasTower ? "about " + round(strength).toLocaleString("en-US") : round(strength * 0.7).toLocaleString("en-US") + " to " + round(strength * 1.3).toLocaleString("en-US");
}

// What the loot for destroying an outpost is
export function loot(strength) {
	return { wood: Math.round(strength * 20), iron: Math.round(strength * 8), bronze: Math.round(strength * 2), gold: Math.round(strength * 0.3), xp: Math.round(strength * 5) };
}
