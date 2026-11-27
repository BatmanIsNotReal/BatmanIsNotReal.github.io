// The rules shared by the game (browser) and the server: attributes, and later the underground.
// This is a .mjs file so that both can import it: the browser with a normal import, server.js with import().

export const ATTRIBUTE_KEYS = ["health", "defence", "strength", "magic"];
export const ATTRIBUTE_LABELS = { health: "Health", defence: "Defence", strength: "Strength", magic: "Magic" };
export const POINTS_PER_LEVEL = 5;
export const MAX_ATTRIBUTE = 999;

// Every attribute starts at level 1. Each player level gives 5 points to spend.
export const defaultAttributes = () => ({ health: 1, defence: 1, strength: 1, magic: 1 });

export function pointsEarned(playerLevel) {
	return POINTS_PER_LEVEL * Math.max(0, playerLevel - 1);
}

export function pointsSpent(attributes) {
	return ATTRIBUTE_KEYS.reduce((sum, key) => sum + (attributes[key] - 1), 0);
}

export function pointsAvailable(playerLevel, attributes) {
	return pointsEarned(playerLevel) - pointsSpent(attributes);
}

// Takes anything and returns four whole numbers between 1 and MAX_ATTRIBUTE
export function cleanAttributes(value) {
	const result = defaultAttributes();
	if (value && typeof value === "object") {
		for (const key of ATTRIBUTE_KEYS) {
			const number = value[key];
			if (Number.isInteger(number) && number >= 1) result[key] = Math.min(MAX_ATTRIBUTE, number);
		}
	}
	return result;
}

// What each attribute does (used by the underground)
export const maxHealth = (health) => 40 + 12 * (health - 1);
export const damageTaken = (damage, defence) => Math.max(1, Math.round((damage * 100) / (100 + 8 * (defence - 1))));
export const clawDamage = (strength) => 8 + 3 * (strength - 1);
export const fireDamage = (magic) => 10 + 3.5 * (magic - 1);

// A line for the level-up window: what the next point would give
export const EFFECT_TEXT = {
	health: (level) => `Max health ${maxHealth(level)}`,
	defence: (level) => `Takes ${Math.round(100 - (100 * 100) / (100 + 8 * (level - 1)))}% less damage`,
	strength: (level) => `Claw damage ${clawDamage(level)}`,
	magic: (level) => `Fire damage ${Math.round(fireDamage(level))}`,
};

// ---------------------------------------------------------------------------------------------
// The underground. Everything here is shared: the browser draws it, the server runs it.
// All numbers are first guesses and meant to be tuned after playtesting.
// ---------------------------------------------------------------------------------------------

export const ARENA = { width: 2400, height: 1600 };
export const DEATH_LOSS = 0.02;          // share of wood, iron, bronze and gold lost on dying
export const HELMET_CHANCE = 1 / 800;    // per monster kill
export const PLAYER_RADIUS = 16;
export const PLAYER_SPEED = 190;
export const CLAW = { range: 70, arc: Math.PI * 0.62, cooldown: 0.4 };
export const FIRE = { speed: 480, life: 1.1, radius: 7, cooldown: 0.7 };
export const RESPAWN_SECONDS = 3;
export const SHIELD_SECONDS = 2;

// kind = which sprite is drawn, colour tints it. hp/damage are for the dungeon's first monster; each
// further monster of a dungeon is a bit tougher (see monstersOf).
const T = (name, kind, color, hpMul, dmgMul, speed, radius, rewardMul = 1) => ({ name, kind, color, hpMul, dmgMul, speed, radius, rewardMul });

const HP = [24, 70, 160, 320, 600];
const DMG = [5, 13, 24, 38, 56];
const REWARD = [
	{ wood: 12, iron: 3, bronze: 0, gold: 0, xp: 10 },
	{ wood: 30, iron: 10, bronze: 3, gold: 0, xp: 60 },
	{ wood: 70, iron: 30, bronze: 10, gold: 2, xp: 300 },
	{ wood: 150, iron: 80, bronze: 30, gold: 8, xp: 1200 },
	{ wood: 300, iron: 180, bronze: 70, gold: 25, xp: 5000 },
];

const MONSTER_TYPES = [
	[T("Cave Rat", "quadruped", "#8a6f55", 0.8, 0.8, 120, 12), T("Giant Bat", "bat", "#5b4a7a", 0.6, 1, 150, 12, 0.9), T("Ghoul Pup", "humanoid", "#6f8f5a", 1.3, 1, 90, 14, 1.2)],
	[T("Skeleton", "humanoid", "#d8d4c0", 0.9, 1, 105, 15), T("Zombie", "humanoid", "#6a8f6a", 1.4, 1, 70, 17, 1.2), T("Crypt Spider", "quadruped", "#3b3340", 0.8, 1.2, 135, 14, 1.1)],
	[T("Fledgling Vampire", "humanoid", "#b8525e", 0.9, 1.1, 120, 15), T("Ghoul", "humanoid", "#7a9a52", 1.3, 1, 95, 17, 1.1), T("Blood Wraith", "ghost", "#a02030", 1, 1.2, 110, 16, 1.3)],
	[T("Fire Imp", "bat", "#e0662a", 0.7, 1.1, 160, 13), T("Hellhound", "quadruped", "#a63a22", 1.2, 1.1, 140, 18, 1.1), T("Vampire Knight", "humanoid", "#7a4a8a", 1.5, 1.1, 100, 19, 1.4)],
	[T("Vampire Lord", "humanoid", "#5a1a3a", 1.2, 1.2, 125, 19), T("Shadow Demon", "ghost", "#2a2a4a", 1, 1.3, 140, 18, 1.2), T("Bone Colossus", "brute", "#cfc7ad", 2, 1.2, 80, 26, 1.6)],
];

export const DUNGEONS = [
	{ id: 1, name: "The Dripping Tunnels", min: 1, max: 5 },
	{ id: 2, name: "The Bone Halls", min: 5, max: 8 },
	{ id: 3, name: "The Crimson Crypt", min: 8, max: 11 },
	{ id: 4, name: "The Molten Depths", min: 11, max: 13 },
	{ id: 5, name: "The Black Throne", min: 13, max: 15 },
	{ id: 6, name: "The Abyss", min: 5, max: 99, pvp: true },
];

export const LOOT_CHANCE = 1 / 600;      // per monster kill, for hair and for a robe (each rolled on its own)
export const HAIR_NAMES = ["", "Tangled mop", "Ponytail", "Warrior braids", "Flame crest", "Shadow mane"];
export const ROBE_NAMES = ["", "Rat-pelt cloak", "Bone-plate robe", "Crimson vestments", "Ember mantle", "Black Throne regalia"];
export const SHIRT_NAMES = ["", "Plain shirt", "Striped shirt", "Laced shirt", "Squire's vest"];
export const ARMOR_NAMES = ["", "Bronze armour", "Blue armour", "Green armour", "Red armour"];
export const WEAPON_NAMES = ["", "Oak staff", "Iron sword", "Crystal staff", "Silver sword", "Blood staff", "Flame sword"];
export const LOOT_NAMES = { hair: HAIR_NAMES, robe: ROBE_NAMES, shirt: SHIRT_NAMES, armor: ARMOR_NAMES, weapon: WEAPON_NAMES };
// What each kind of loot is called in the player file (list of owned item numbers)
export const LOOT_LISTS = { hair: "hairs", robe: "robes", shirt: "shirts", armor: "armors", weapon: "weapons" };
// Hair and robes: item number = dungeon number. The rest: a random item the dungeon is "deep" enough for
// (LOOT_TIERS[kind][item] = the first dungeon where it can drop).
export const LOOT_TIERS = { shirt: [0, 1, 1, 2, 3], armor: [0, 1, 3, 2, 4], weapon: [0, 1, 1, 2, 3, 4, 5] };
// Where the found items sit in the avatar's choice numbers: choice = start + item - 1 (weapon: choice = item).
export const PART_BASE = { hairStyle: 7, cloak: 6, weapon: 1 };
export const PART_GROUPS = {
	hairStyle: [{ kind: "hair", start: 7, count: 5 }],
	cloak: [{ kind: "robe", start: 6, count: 5 }, { kind: "shirt", start: 11, count: 4 }, { kind: "armor", start: 15, count: 4 }],
	weapon: [{ kind: "weapon", start: 1, count: 6 }],
};
// owned = { hair: [item numbers], robe: [...], shirt: [...], armor: [...], weapon: [...] }
export function choiceAllowed(key, index, owned = {}) {
	if (!(key in PART_BASE)) return true;
	if (index < PART_BASE[key]) return true;
	for (const group of PART_GROUPS[key]) {
		if (index >= group.start && index < group.start + group.count) return (owned[group.kind] || []).includes(index - group.start + 1);
	}
	return false;
}
export function lootItem(kind, dungeon, random) {
	const tiers = LOOT_TIERS[kind];
	if (!tiers) return dungeon;
	const items = [];
	for (let item = 1; item < tiers.length; item++) if (tiers[item] <= dungeon) items.push(item);
	return items[Math.floor(random() * items.length)];
}
export const HELMET_NAMES = ["", "Gnawed Rat Skull", "Bone Crown", "Crimson Cowl", "Molten Horns", "Helm of the Black Throne"];

export const dungeonById = (id) => DUNGEONS.find((d) => d.id === id) || null;
export const canEnter = (dungeon, level) => !!dungeon && level >= dungeon.min;

// The monsters of one dungeon with their numbers worked out. Dungeons 1-5 only.
export function monstersOf(dungeonId) {
	const i = dungeonId - 1;
	if (i < 0 || i > 4) return [];
	return MONSTER_TYPES[i].map((t) => ({
		name: t.name, kind: t.kind, color: t.color, speed: t.speed, radius: t.radius,
		hp: Math.round(HP[i] * t.hpMul),
		damage: Math.round(DMG[i] * t.dmgMul),
		reward: Object.fromEntries(Object.entries(REWARD[i]).map(([k, v]) => [k, Math.round(v * t.rewardMul)])),
	}));
}
