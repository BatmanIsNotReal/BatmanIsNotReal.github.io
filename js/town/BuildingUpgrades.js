// Upgrading buildings: every farm, lumber mill, mine, hut and blood temple on the map has its own level (0 to 10).
// All the numbers of the system are here, so balancing it means changing this file only.

export const MAX_LEVEL = 10;

// Tile type number -> building that can be upgraded
export const UPGRADABLE = { 1: "Hut", 4: "Mine", 5: "Farm", 7: "LumberMill", 8: "BloodTemple" };

// Output of farms, lumber mills and mines grows by this much of the base for every level
export const OUTPUT_PER_LEVEL = 0.15;   // level 10 = 2.5x (tuned with the economy simulation: 0.25 gave 3.5x)
// Huts give this much more room for familiars per level
export const HUT_ROOM_PER_LEVEL = 2;
// Blood temple: per level, the blessing chance (percentage points) and the influence boost (percentage points)
export const TEMPLE_CHANCE_PER_LEVEL = 1.0;   // level 10: 20% chance per round
export const TEMPLE_BOOST_PER_LEVEL = 2.0;    // level 10: influence +45%

// Price of the FIRST upgrade (level 0 -> 1). Later levels cost more, see costFor().
//   wood, iron:   from the first level on
//   bronze:       from level 4 on
//   gold:         from level 7 on
//   blood:        every level
//   workers + familiarFactor: free familiars that are put to work on the upgrade
const BASE = {
	Farm:        { wood: 300,   iron: 60,    bronze: 40,   gold: 6,   blood: 1000,   workers: 5,  familiarFactor: 0.2 },
	LumberMill:  { wood: 400,   iron: 80,    bronze: 50,   gold: 8,   blood: 1200,   workers: 5,  familiarFactor: 0.2 },
	Mine:        { wood: 1500,  iron: 500,   bronze: 300,  gold: 50,  blood: 20000,  workers: 10, familiarFactor: 0.2 },
	Hut:         { wood: 150,   iron: 30,    bronze: 20,   gold: 3,   blood: 500,    workers: 0,  familiarFactor: 0 }, // huts cost no familiars
	BloodTemple: { wood: 4000,  iron: 6000,  bronze: 2000, gold: 400, blood: 500000, workers: 40, familiarFactor: 0.1 },
};
const COST_GROWTH = 1.5;   // resources: every level costs 50% more than the one before
const BLOOD_GROWTH = 1.6;

const exact = (value) => Math.ceil(Number(value.toFixed(6))); // 55.00000000000001 -> 55

// What upgrading a building from `level` to `level + 1` costs
export function costFor(key, level){
	const base = BASE[key];
	const next = level + 1;
	return {
		wood: exact(base.wood * Math.pow(COST_GROWTH, level)),
		iron: exact(base.iron * Math.pow(COST_GROWTH, level)),
		bronze: next >= 4 ? exact(base.bronze * Math.pow(COST_GROWTH, next - 4)) : 0,
		gold: next >= 7 ? exact(base.gold * Math.pow(COST_GROWTH, next - 7)) : 0,
		blood: exact(base.blood * Math.pow(BLOOD_GROWTH, level)),
		familiars: exact(base.workers * base.familiarFactor * (1 + level / 2)),
	};
}

// Farms, lumber mills and mines: how much their loot is multiplied
export function outputMultiplier(level){
	return 1 + OUTPUT_PER_LEVEL * level;
}

// Blood temple at a level
export function templeChance(level){
	return (10 + TEMPLE_CHANCE_PER_LEVEL * level) / 100;
}

export function templeBoost(level){
	return (125 + TEMPLE_BOOST_PER_LEVEL * level) / 100;
}

// Text describing what a level gives
export function effectText(key, level){
	const percent = (value) => String(Math.round(value * 10) / 10);
	if (key === "Hut") return level > 0 ? "room for " + HUT_ROOM_PER_LEVEL * level + " more familiars" : "no extra room yet";
	if (key === "BloodTemple") return percent(10 + TEMPLE_CHANCE_PER_LEVEL * level) + "% blessing chance per round, influence +" + percent(25 + TEMPLE_BOOST_PER_LEVEL * level) + "%";
	return level > 0 ? "+" + percent(OUTPUT_PER_LEVEL * 100 * level) + "% output" : "no bonus yet";
}
