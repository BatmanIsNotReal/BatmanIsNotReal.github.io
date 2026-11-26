// Vampire House server: serves the game and runs the chat.
// Zero dependencies. Start it with:  node server.js   (needs Node.js 18 or newer)
//
// Settings (all optional, set as environment variables):
//   PORT           port to listen on                       (default 8000)
//   HOST           address to listen on                    (default 0.0.0.0)
//   TRUST_PROXY    set to 1 if you run behind a reverse proxy, so the real
//                  visitor IP is used for rate limiting    (default off)
//   DATA_DIR       folder for chat.json, players.json and dice.json   (default ./server-data)
//                  On hosts that wipe the disk on every deploy, point this at a
//                  persistent volume or the data is lost.
//   ONLINE_WINDOW_SECONDS  how long a player counts as active after their last
//                  sign of life                            (default 90)

const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { hasSlur } = require("./wordFilter");

const PORT = Number(process.env.PORT) || 8000;
const HOST = process.env.HOST || "0.0.0.0";
const TRUST_PROXY = process.env.TRUST_PROXY === "1";

const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "server-data");
const CHAT_FILE = path.join(DATA_DIR, "chat.json");
const PLAYERS_FILE = path.join(DATA_DIR, "players.json");
const DICE_FILE = path.join(DATA_DIR, "dice.json");
const FRIENDS_FILE = path.join(DATA_DIR, "friends.json");

// ---------- Chat limits ----------
const MAX_STORED_MESSAGES = 200;   // older messages are dropped
const FIRST_LOAD_MESSAGES = 50;    // what a brand new visitor sees
const MAX_NAME_LENGTH = 20;
const MAX_TEXT_LENGTH = 300;
const MAX_BODY_BYTES = 4 * 1024;
const MAX_PROFILE_BODY_BYTES = 32 * 1024; // a profile carries a snapshot of the map
const RATE_LIMIT_COUNT = 5;        // messages ...
const RATE_LIMIT_WINDOW_MS = 10000; // ... per 10 seconds per visitor

// ---------- Player file limits ----------
const MAX_PLAYERS = 5000;          // new players are refused beyond this
const PLAYER_RATE_LIMIT_COUNT = 30; // saves ...
const PLAYER_RATE_LIMIT_WINDOW_MS = 60000; // ... per minute per visitor
const MAX_STAT_VALUE = 1e15;
const MAX_LEVEL = 1000;
const LEADERBOARD_DEFAULT_ROWS = 20;
const LEADERBOARD_MAX_ROWS = 50;
const STAT_KEYS = ["blood", "humanFood", "wood", "iron", "bronze", "gold", "familiars", "influence"];

// ---------- Active players ----------
const ONLINE_WINDOW_MS = (Number(process.env.ONLINE_WINDOW_SECONDS) || 90) * 1000;
const MAX_TRACKED_ONLINE = 20000;

// ---------- Chat storage ----------
let messages = [];
let nextId = 1;

function loadMessages() {
	try {
		const saved = JSON.parse(fs.readFileSync(CHAT_FILE, "utf8"));
		if (Array.isArray(saved.messages)) {
			messages = saved.messages.slice(-MAX_STORED_MESSAGES);
			nextId = messages.reduce((max, m) => Math.max(max, m.id), 0) + 1;
		}
	} catch {
		// No saved chat yet (or the file is damaged): start with an empty chat.
	}
}

// Writes a file a moment after the data changes (many changes become one write).
// The file is written to a temp name first and swapped in, so it is never half-written.
function makeSaver(file, getData, delayMs, indent) {
	let timer = null;
	return function saveSoon() {
		if (timer) return;
		timer = setTimeout(() => {
			timer = null;
			try {
				fs.mkdirSync(DATA_DIR, { recursive: true });
				const temp = file + ".tmp";
				fs.writeFileSync(temp, JSON.stringify(getData(), null, indent));
				fs.renameSync(temp, file);
			} catch (error) {
				console.error(`Could not save ${path.basename(file)}:`, error.message);
			}
		}, delayMs);
	};
}

const saveMessages = makeSaver(CHAT_FILE, () => ({ messages }), 500);

// ---------- Player storage ----------
// id (random, made by the player's browser) -> { vampireName, settlementName, createdAt, updatedAt, stats }
const players = new Map();

// Vampire names must be unique. Names are compared without caps, spaces or lookalike
// width forms, so "Count Dracula", "count  dracula" and "CountDracula" are the same name.
const nameOwners = new Map(); // normalised name -> player id

function nameKey(name) {
	return name.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}

function loadPlayers() {
	try {
		const saved = JSON.parse(fs.readFileSync(PLAYERS_FILE, "utf8"));
		for (const [id, record] of Object.entries(saved.players || {})) {
			if (/^[a-f0-9]{32}$/.test(id) && record && typeof record === "object") {
				players.set(id, record);
				const key = nameKey(String(record.vampireName || ""));
				if (key && !nameOwners.has(key)) nameOwners.set(key, id);
			}
		}
	} catch {
		// No players saved yet (or the file is damaged): start empty.
	}
}

const savePlayers = makeSaver(PLAYERS_FILE, () => ({ players: Object.fromEntries(players) }), 2000, 2);

// Remove control characters, squash whitespace, cut to length (by character, not byte).
function clean(value, maxLength) {
	if (typeof value !== "string") return "";
	const text = value
		.replace(/[\u200B-\u200F\u2060\uFEFF\u00AD]/g, "") // zero-width and invisible characters
		.replace(/[\u0000-\u001F\u007F-\u009F\u2028\u2029]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	return Array.from(text).slice(0, maxLength).join("");
}

// ---------- Rate limiting ----------
function createRateLimiter(limit, windowMs) {
	const recent = new Map(); // ip -> timestamps

	setInterval(() => {
		const now = Date.now();
		for (const [ip, stamps] of recent) {
			if (stamps.every((t) => now - t >= windowMs)) recent.delete(ip);
		}
	}, 60000).unref();

	return function isLimited(ip) {
		const now = Date.now();
		const stamps = (recent.get(ip) || []).filter((t) => now - t < windowMs);
		if (stamps.length >= limit) {
			recent.set(ip, stamps);
			return true;
		}
		stamps.push(now);
		recent.set(ip, stamps);
		return false;
	};
}

const isChatRateLimited = createRateLimiter(RATE_LIMIT_COUNT, RATE_LIMIT_WINDOW_MS);
const isPlayerRateLimited = createRateLimiter(PLAYER_RATE_LIMIT_COUNT, PLAYER_RATE_LIMIT_WINDOW_MS);
const isLeaderboardRateLimited = createRateLimiter(30, 60000);
const isOnlineRateLimited = createRateLimiter(60, 60000);

function clientIp(req) {
	if (TRUST_PROXY) {
		const forwarded = req.headers["x-forwarded-for"];
		if (forwarded) return forwarded.split(",")[0].trim();
	}
	return req.socket.remoteAddress || "unknown";
}

// ---------- Helpers ----------
function sendJson(res, status, body) {
	const text = JSON.stringify(body);
	res.writeHead(status, {
		"Content-Type": "application/json; charset=utf-8",
		"Content-Length": Buffer.byteLength(text),
		"Cache-Control": "no-store",
		// The chat is public and uses no cookies, so any site may talk to it.
		// That lets the game on GitHub Pages use a chat server hosted elsewhere.
		"Access-Control-Allow-Origin": "*",
	});
	res.end(text);
}

function readJsonBody(req, maxBytes = MAX_BODY_BYTES) {
	return new Promise((resolve, reject) => {
		let size = 0;
		let tooBig = false;
		const chunks = [];
		req.on("data", (chunk) => {
			if (tooBig) return; // keep draining, but ignore the rest of an oversized upload
			size += chunk.length;
			if (size > maxBytes) {
				tooBig = true;
				chunks.length = 0;
				reject(Object.assign(new Error("Message too large"), { status: 413 }));
				return;
			}
			chunks.push(chunk);
		});
		req.on("end", () => {
			if (tooBig) return;
			try {
				resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
			} catch {
				reject(Object.assign(new Error("Invalid JSON"), { status: 400 }));
			}
		});
		req.on("error", reject);
	});
}

function sendPreflight(res) {
	res.writeHead(204, {
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type",
		"Access-Control-Max-Age": "86400",
	});
	res.end();
}

// ---------- Chat API ----------
async function handleChat(req, res, url) {
	if (req.method === "OPTIONS") return sendPreflight(res);

	if (req.method === "GET") {
		const after = Number.parseInt(url.searchParams.get("after"), 10);
		const list = after > 0
			? messages.filter((m) => m.id > after)
			: messages.slice(-FIRST_LOAD_MESSAGES);
		return sendJson(res, 200, { messages: list, lastId: nextId - 1 });
	}

	if (req.method === "POST") {
		let body;
		try {
			body = await readJsonBody(req);
		} catch (error) {
			return sendJson(res, error.status || 400, { error: error.message });
		}

		const text = clean(body && body.text, MAX_TEXT_LENGTH);
		const name = clean(body && body.name, MAX_NAME_LENGTH) || "Vampire";
		if (!text) return sendJson(res, 400, { error: "Message is empty" });
		if (RESERVED_KEYS.has(nameKey(name))) return sendJson(res, 400, { error: "That name is reserved." });

		if (isChatRateLimited(clientIp(req))) {
			return sendJson(res, 429, { error: "You are sending messages too fast. Wait a few seconds." });
		}

		const message = { id: nextId++, name, text, time: Date.now() };
		messages.push(message);
		if (messages.length > MAX_STORED_MESSAGES) messages = messages.slice(-MAX_STORED_MESSAGES);
		saveMessages();
		return sendJson(res, 201, { message });
	}

	res.writeHead(405, { Allow: "GET, POST, OPTIONS" });
	res.end();
}

// ---------- Player API ----------
// POST /api/player  { id, vampireName, settlementName, level, stats: { blood, humanFood, ... } }
// Saves the player's names and stats into players.json. There is deliberately no
// way to read the file back through the API, so one player cannot see another's id.
async function handlePlayer(req, res) {
	if (req.method === "OPTIONS") return sendPreflight(res);
	if (req.method !== "POST") {
		res.writeHead(405, { Allow: "POST, OPTIONS" });
		return res.end();
	}

	let body;
	try {
		body = await readJsonBody(req);
	} catch (error) {
		return sendJson(res, error.status || 400, { error: error.message });
	}
	body = body && typeof body === "object" ? body : {};

	const id = typeof body.id === "string" ? body.id : "";
	if (!/^[a-f0-9]{32}$/.test(id)) return sendJson(res, 400, { error: "Invalid player id" });

	const vampireName = clean(body.vampireName, MAX_NAME_LENGTH);
	const settlementName = clean(body.settlementName, MAX_NAME_LENGTH);
	if (!vampireName || !settlementName) {
		return sendJson(res, 400, { error: "A vampire name and a settlement name are required" });
	}

	if (isPlayerRateLimited(clientIp(req))) {
		return sendJson(res, 429, { error: "Saving too often. Try again in a moment." });
	}
	if (hasSlur(vampireName) || hasSlur(settlementName)) {
		return sendJson(res, 400, { error: "That name is not allowed. Please choose another." });
	}

	// A vampire name can only belong to one player.
	const key = nameKey(vampireName);
	if (RESERVED_KEYS.has(key)) return sendJson(res, 409, { error: "That name is reserved. Choose another." });
	const owner = nameOwners.get(key);
	if (owner && owner !== id) {
		return sendJson(res, 409, { error: "That vampire name is already taken. Choose another." });
	}

	const existing = players.get(id);
	if (!existing && players.size >= MAX_PLAYERS) {
		return sendJson(res, 503, { error: "This server cannot store any more players" });
	}

	const stats = {};
	const sent = body.stats && typeof body.stats === "object" ? body.stats : {};
	for (const key of STAT_KEYS) {
		const value = Number(sent[key]);
		stats[key] = Number.isFinite(value) ? Math.min(Math.max(Math.round(value * 100) / 100, 0), MAX_STAT_VALUE) : 0;
	}

	const level = Number.isInteger(body.level) ? Math.min(Math.max(body.level, 1), MAX_LEVEL) : 1;

	// Free the old name if this player is changing it.
	if (existing) {
		const oldKey = nameKey(String(existing.vampireName || ""));
		if (oldKey !== key && nameOwners.get(oldKey) === id) nameOwners.delete(oldKey);
	}
	nameOwners.set(key, id);

	const now = Date.now();
	players.set(id, {
		vampireName,
		settlementName,
		level,
		createdAt: existing ? existing.createdAt : now,
		updatedAt: now,
		stats,
		...(existing && existing.profile ? { profile: existing.profile } : {}),
		...(existing && existing.helmets ? { helmets: existing.helmets } : {}),
	});
	savePlayers();
	return sendJson(res, 200, { ok: true });
}

// ---------- Character pages ----------
// POST /api/profile { id, avatar, bio, accent, isPublic, showResources, showMap, map? }
//      Saves how the player looks and what they show on their page. The player must exist already.
// GET  /api/profile?name=Vlad
//      -> the public page of that player. A private page only gives name, "private": true and the avatar.
// The numbers and the map come from the player's own browser (like everything in the player file),
// so they can be faked. This is a showcase, not a ranking you can trust blindly.
const isProfileRateLimited = createRateLimiter(20, 60000);
const isProfileReadRateLimited = createRateLimiter(60, 60000);
const AVATAR_KEYS = { skin: 6, hairStyle: 7, hairColor: 8, eyes: 5, eyeColor: 6, mouth: 5, cloak: 6, cloakColor: 8, accessory: 7 };
const MAX_BIO_LENGTH = 150;
const ATTRIBUTE_KEYS = ["health", "defence", "strength", "magic"];
const POINTS_PER_LEVEL = 5;

// Four levels from 1 up. Nobody can have more than 5 points per level reached (the level is also
// reported by the player, so this stops mistakes and casual cheating, not a determined one).
function cleanAttributes(value, level, fallback) {
	const result = {};
	let spent = 0;
	for (const key of ATTRIBUTE_KEYS) {
		const number = value && typeof value === "object" ? value[key] : undefined;
		if (!Number.isInteger(number) || number < 1 || number > 999) return fallback || { health: 1, defence: 1, strength: 1, magic: 1 };
		result[key] = number;
		spent += number - 1;
	}
	return spent <= POINTS_PER_LEVEL * Math.max(0, (level || 1) - 1) ? result : fallback || { health: 1, defence: 1, strength: 1, magic: 1 };
}
const ACCENT_COUNT = 8;

function cleanAvatar(value) {
	const avatar = {};
	const sent = value && typeof value === "object" ? value : {};
	for (const [key, count] of Object.entries(AVATAR_KEYS)) {
		const number = sent[key];
		avatar[key] = Number.isInteger(number) && number >= 0 && number < count ? number : 0;
	}
	return avatar;
}

// The map as two strings: one digit per tile for what is there (0-9 and a-e) and one character
// for the building level (0-9, "a" = 10), row by row.
function cleanMap(value) {
	if (!value || typeof value !== "object") return null;
	const { width, height, tiles, levels } = value;
	if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 200 || height > 100) return null;
	const count = width * height;
	if (typeof tiles !== "string" || tiles.length !== count || !/^[0-9a-f]+$/.test(tiles)) return null;
	if (typeof levels !== "string" || levels.length !== count || !/^[0-9a]+$/.test(levels)) return null;
	return { width, height, tiles, levels };
}

async function handleProfile(req, res, url) {
	if (req.method === "OPTIONS") return sendPreflight(res);

	if (req.method === "GET") {
		if (isProfileReadRateLimited(clientIp(req))) return sendJson(res, 429, { error: "Too many requests. Try again in a moment." });
		const name = clean(url.searchParams.get("name") || "", MAX_NAME_LENGTH);
		const id = name ? nameOwners.get(nameKey(name)) : null;
		const player = id ? players.get(id) : null;
		if (!player) return sendJson(res, 404, { error: "No vampire with that name was found." });

		const profile = player.profile || {};
		const page = {
			vampireName: player.vampireName,
			avatar: profile.avatar || null,
			accent: profile.accent || 0,
			helmet: profile.helmet || 0,
			level: player.level || 1,
			online: lastSeen.has(id) && Date.now() - lastSeen.get(id) < ONLINE_WINDOW_MS,
		};
		if (profile.isPublic === false) return sendJson(res, 200, { ...page, private: true });

		page.settlementName = player.settlementName;
		page.bio = profile.bio || "";
		page.createdAt = player.createdAt;
		page.diceWins = diceWins.get(id) || 0;
		page.helmet = profile.helmet || 0;
		page.attributes = profile.attributes || cleanAttributes(null);
		page.influence = player.stats.influence;
		page.familiars = player.stats.familiars;
		if (profile.showResources !== false) page.stats = player.stats;
		if (profile.showMap !== false && profile.map) page.map = profile.map;
		return sendJson(res, 200, page);
	}

	if (req.method !== "POST") {
		res.writeHead(405, { Allow: "GET, POST, OPTIONS" });
		return res.end();
	}

	let body;
	try {
		body = await readJsonBody(req, MAX_PROFILE_BODY_BYTES);
	} catch (error) {
		return sendJson(res, error.status || 400, { error: error.message });
	}
	body = body && typeof body === "object" ? body : {};

	const id = typeof body.id === "string" ? body.id : "";
	if (!/^[a-f0-9]{32}$/.test(id)) return sendJson(res, 400, { error: "Invalid player id" });
	if (isProfileRateLimited(clientIp(req))) return sendJson(res, 429, { error: "Saving too often. Try again in a moment." });
	const player = players.get(id);
	if (!player) return sendJson(res, 404, { error: "Create your vampire first." });

	const bio = clean(body.bio, MAX_BIO_LENGTH);
	if (hasSlur(bio)) return sendJson(res, 400, { error: "Please keep your description friendly. That text is not allowed." });

	const previous = player.profile || {};
	const accent = Number.isInteger(body.accent) && body.accent >= 0 && body.accent < ACCENT_COUNT ? body.accent : 0;
	const map = ("map" in body && cleanMap(body.map)) || previous.map || null;
	player.profile = {
		avatar: cleanAvatar(body.avatar),
		bio,
		accent,
		isPublic: body.isPublic !== false,
		showResources: body.showResources !== false,
		showMap: body.showMap !== false,
		map,
		helmet: "helmet" in body ? (body.helmet === 0 || (player.helmets || []).includes(body.helmet) ? body.helmet : previous.helmet || 0) : previous.helmet || 0,
		attributes: "attributes" in body ? cleanAttributes(body.attributes, player.level, previous.attributes) : previous.attributes || cleanAttributes(null),
	};
	player.updatedAt = Date.now();
	savePlayers();
	return sendJson(res, 200, { ok: true, helmets: player.helmets || [] });
}

// ---------- Active players API ----------
// POST /api/online { id }  -> the player is active right now; answers { online }
// GET  /api/online         -> { online }   (number of players seen in the last 90 seconds)
// Both answers also carry "names": the vampire names of the players seen in that time
// (shown in the chat's "Online" column). Only vampire names are handed out, nothing else.
const lastSeen = new Map(); // player id -> time of the last sign of life

function countOnline() {
	const now = Date.now();
	for (const [id, time] of lastSeen) {
		if (now - time >= ONLINE_WINDOW_MS) lastSeen.delete(id);
	}
	return lastSeen.size;
}

// Welcome message in the chat when a signed-up player comes online.
// - Not for the first minutes after a server start (everybody "arrives" at once then).
// - At most one welcome per player every 30 minutes, so a flaky connection or a
//   closed-and-reopened tab does not fill the chat.
const SERVER_START = Date.now();
const WELCOME_QUIET_AFTER_START_MS = ONLINE_WINDOW_MS + 60000;
const WELCOME_COOLDOWN_MS = 30 * 60000;
const lastWelcome = new Map(); // player id -> time of their last welcome

function welcomePlayer(id, now) {
	const player = players.get(id);
	if (!player) return;
	if (now - SERVER_START < WELCOME_QUIET_AFTER_START_MS) return;
	if (now - (lastWelcome.get(id) || 0) < WELCOME_COOLDOWN_MS) return;
	if (lastWelcome.size >= MAX_TRACKED_ONLINE) lastWelcome.clear();
	lastWelcome.set(id, now);
	postChatAnnouncement("Welcome, " + player.vampireName + " of " + player.settlementName + "! The night awaits you.", CRIER_NAME);
}

const MAX_ONLINE_NAMES = 200;
function onlineNames() {
	const names = [];
	for (const id of lastSeen.keys()) {
		const player = players.get(id);
		if (player && player.vampireName) names.push(player.vampireName);
	}
	return names.sort((a, b) => a.localeCompare(b)).slice(0, MAX_ONLINE_NAMES);
}

async function handleOnline(req, res) {
	if (req.method === "OPTIONS") return sendPreflight(res);
	if (req.method !== "GET" && req.method !== "POST") {
		res.writeHead(405, { Allow: "GET, POST, OPTIONS" });
		return res.end();
	}
	if (isOnlineRateLimited(clientIp(req))) {
		return sendJson(res, 429, { error: "Too many requests. Try again in a moment." });
	}

	if (req.method === "POST") {
		let body;
		try {
			body = await readJsonBody(req);
		} catch (error) {
			return sendJson(res, error.status || 400, { error: error.message });
		}
		const id = body && typeof body.id === "string" ? body.id : "";
		if (!/^[a-f0-9]{32}$/.test(id)) return sendJson(res, 400, { error: "Invalid player id" });
		const now = Date.now();
		const wasOnline = now - (lastSeen.get(id) || 0) < ONLINE_WINDOW_MS;
		if (lastSeen.has(id) || lastSeen.size < MAX_TRACKED_ONLINE) lastSeen.set(id, now);
		if (!wasOnline) welcomePlayer(id, now);
	}
	return sendJson(res, 200, { online: countOnline(), names: onlineNames() });
}

// ---------- Dice game ----------
// Two players bet the same bundle of resources and the server rolls two dice for each;
// the higher total takes both bundles. A tie gives everyone their bundle back.
// The server rolls (so nobody can cheat the dice) and keeps the bets safe. Resources live in
// each player's browser, so the server hands out "settlements" (+/- resources) that the
// browser applies once and then confirms (ack). Nothing is lost if a player closes the page:
// their settlements wait on the server until the game is opened again.
//
// POST /api/dice  { id, action: "state" | "create" | "accept" | "cancel" | "ack", ... }
const DICE_NAME = "Dice Master";       // announces big wins in the chat; no player may use this name
const DICE_KEY = nameKey(DICE_NAME);
const CRIER_NAME = "Town Crier";      // welcomes players when they come online; also reserved
const RESERVED_KEYS = new Set([DICE_KEY, nameKey(CRIER_NAME)]);
const DICE_RESOURCES = ["blood", "humanFood", "wood", "iron", "bronze", "gold"];
const DICE_RESOURCE_NAMES = { blood: "blood", humanFood: "human food", wood: "wood", iron: "iron", bronze: "bronze", gold: "gold" };
// How much one piece of each resource counts for when deciding if a win is "big"
const DICE_WEIGHTS = { blood: 1, humanFood: 1, wood: 1, iron: 3, bronze: 5, gold: 20 };
const BIG_WIN_VALUE = 2000;            // a win this big (value of the other player's bet) is announced in the chat
const DICE_CHALLENGE_TTL_MS = 60 * 60 * 1000; // an unanswered challenge is cancelled after an hour
const MAX_OPEN_PER_PLAYER = 3;
const MAX_OPEN_TOTAL = 500;
const MAX_PENDING_SETTLEMENTS = 100;
const MAX_STAKE = 1e12;
const RECENT_MATCHES = 15;

const challenges = new Map();   // challenge id -> { id, creatorId, creatorName, targetId, targetName, stake, createdAt }
const settlements = new Map();  // player id -> [ { id, delta, message, match } ]
const diceWins = new Map();     // player id -> number of games won
let recentMatches = [];

const saveDice = makeSaver(DICE_FILE, () => ({
	challenges: [...challenges.values()],
	settlements: Object.fromEntries(settlements),
	wins: Object.fromEntries(diceWins),
	recent: recentMatches,
}), 1000, 2);

function loadDice() {
	try {
		const saved = JSON.parse(fs.readFileSync(DICE_FILE, "utf8"));
		for (const c of saved.challenges || []) if (c && c.id && c.stake) challenges.set(c.id, c);
		for (const [id, list] of Object.entries(saved.settlements || {})) {
			if (Array.isArray(list) && list.length) settlements.set(id, list);
		}
		for (const [id, n] of Object.entries(saved.wins || {})) if (Number.isInteger(n)) diceWins.set(id, n);
		if (Array.isArray(saved.recent)) recentMatches = saved.recent.slice(-RECENT_MATCHES);
	} catch {
		// No dice games saved yet (or the file is damaged): start empty.
	}
}

// A bet: { resource: whole number > 0 } for any mix of resources. Returns null if it is not valid.
function parseStake(input) {
	if (!input || typeof input !== "object") return null;
	const stake = {};
	for (const kind of DICE_RESOURCES) {
		const value = Number(input[kind] || 0);
		if (!Number.isInteger(value) || value < 0 || value > MAX_STAKE) return null;
		if (value > 0) stake[kind] = value;
	}
	return Object.keys(stake).length ? stake : null;
}

function stakeText(stake) {
	return Object.entries(stake).map(([kind, n]) => n + " " + DICE_RESOURCE_NAMES[kind]).join(", ");
}

function stakeValue(stake) {
	return Object.entries(stake).reduce((sum, [kind, n]) => sum + n * DICE_WEIGHTS[kind], 0);
}

// delta: { resource: +/- amount }. Waits on the server until the player's game collects it.
function queueSettlement(playerId, delta, message, match = null) {
	const list = settlements.get(playerId) || [];
	list.push({ id: crypto.randomUUID(), delta, message, match });
	settlements.set(playerId, list);
}

function scaled(stake, factor) {
	return Object.fromEntries(Object.entries(stake).map(([kind, n]) => [kind, n * factor]));
}

function postChatAnnouncement(text, name = DICE_NAME) {
	messages.push({ id: nextId++, name, text: text.slice(0, MAX_TEXT_LENGTH), time: Date.now() });
	if (messages.length > MAX_STORED_MESSAGES) messages = messages.slice(-MAX_STORED_MESSAGES);
	saveMessages();
}

// Cancels a challenge and gives the creator's bet back.
function closeChallenge(challenge, message) {
	challenges.delete(challenge.id);
	queueSettlement(challenge.creatorId, challenge.stake, message);
	saveDice();
}

function expireChallenges() {
	const now = Date.now();
	for (const challenge of [...challenges.values()]) {
		if (now - challenge.createdAt >= DICE_CHALLENGE_TTL_MS) {
			closeChallenge(challenge, "Dice: nobody took your challenge, so your bet is returned (" + stakeText(challenge.stake) + ").");
		}
	}
}
setInterval(expireChallenges, 60000).unref();

function rollTwoDice() {
	return [crypto.randomInt(1, 7), crypto.randomInt(1, 7)];
}

function diceView(challenge) {
	return {
		id: challenge.id,
		creator: challenge.creatorName,
		target: challenge.targetName || null,
		stake: challenge.stake,
		createdAt: challenge.createdAt,
		expiresAt: challenge.createdAt + DICE_CHALLENGE_TTL_MS,
	};
}

function diceState(playerId) {
	const all = [...challenges.values()];
	return {
		open: all.filter((c) => !c.targetId && c.creatorId !== playerId).map(diceView),
		incoming: all.filter((c) => c.targetId === playerId).map(diceView),
		mine: all.filter((c) => c.creatorId === playerId).map(diceView),
		recent: recentMatches,
		wins: diceWins.get(playerId) || 0,
		settlements: settlements.get(playerId) || [],
	};
}

const isDiceRateLimited = createRateLimiter(120, 60000);

async function handleDice(req, res) {
	if (req.method === "OPTIONS") return sendPreflight(res);
	if (req.method !== "POST") {
		res.writeHead(405, { Allow: "POST, OPTIONS" });
		return res.end();
	}
	if (isDiceRateLimited(clientIp(req))) {
		return sendJson(res, 429, { error: "Too many requests. Try again in a moment." });
	}

	let body;
	try {
		body = await readJsonBody(req);
	} catch (error) {
		return sendJson(res, error.status || 400, { error: error.message });
	}
	body = body && typeof body === "object" ? body : {};

	const id = typeof body.id === "string" ? body.id : "";
	if (!/^[a-f0-9]{32}$/.test(id)) return sendJson(res, 400, { error: "Invalid player id" });
	const me = players.get(id);
	if (!me) return sendJson(res, 403, { error: "The server does not know you yet. Wait a few seconds and try again." });

	expireChallenges();
	const action = body.action;

	if (action === "state") {
		return sendJson(res, 200, diceState(id));
	}

	if (action === "ack") {
		const done = new Set(Array.isArray(body.ids) ? body.ids.filter((x) => typeof x === "string").slice(0, 200) : []);
		const left = (settlements.get(id) || []).filter((s) => !done.has(s.id));
		if (left.length) settlements.set(id, left);
		else settlements.delete(id);
		saveDice();
		return sendJson(res, 200, { ok: true });
	}

	if (action === "create") {
		const stake = parseStake(body.stake);
		if (!stake) return sendJson(res, 400, { error: "Choose something to bet." });

		const mineOpen = [...challenges.values()].filter((c) => c.creatorId === id).length;
		if (mineOpen >= MAX_OPEN_PER_PLAYER) {
			return sendJson(res, 400, { error: "You already have " + MAX_OPEN_PER_PLAYER + " open challenges. Cancel one first." });
		}
		if (challenges.size >= MAX_OPEN_TOTAL) return sendJson(res, 503, { error: "Too many open challenges right now." });
		if ((settlements.get(id) || []).length >= MAX_PENDING_SETTLEMENTS) {
			return sendJson(res, 400, { error: "Your game has not collected its earlier results yet. Keep the game open for a moment." });
		}

		let targetId = null;
		let targetName = null;
		const wanted = clean(body.target, MAX_NAME_LENGTH);
		if (wanted) {
			targetId = nameOwners.get(nameKey(wanted));
			if (!targetId || !players.has(targetId)) return sendJson(res, 404, { error: "There is no player called " + wanted + "." });
			if (targetId === id) return sendJson(res, 400, { error: "You cannot challenge yourself." });
			targetName = players.get(targetId).vampireName;
		}

		const challenge = {
			id: crypto.randomUUID(), creatorId: id, creatorName: me.vampireName,
			targetId, targetName, stake, createdAt: Date.now(),
		};
		challenges.set(challenge.id, challenge);
		// The bet is taken out of the creator's storage right away
		queueSettlement(id, scaled(stake, -1), "Dice: you put up " + stakeText(stake) + (targetName ? " against " + targetName : "") + ".");
		saveDice();
		return sendJson(res, 200, { ok: true, challenge: diceView(challenge) });
	}

	const challenge = challenges.get(typeof body.challengeId === "string" ? body.challengeId : "");
	if (!challenge) return sendJson(res, 404, { error: "That challenge is no longer there." });

	if (action === "cancel") {
		if (challenge.creatorId === id) {
			closeChallenge(challenge, "Dice: you cancelled your challenge. Your bet is returned (" + stakeText(challenge.stake) + ").");
			return sendJson(res, 200, { ok: true });
		}
		if (challenge.targetId === id) {
			closeChallenge(challenge, "Dice: " + me.vampireName + " declined your challenge. Your bet is returned (" + stakeText(challenge.stake) + ").");
			return sendJson(res, 200, { ok: true });
		}
		return sendJson(res, 403, { error: "That is not your challenge." });
	}

	if (action === "accept") {
		if (challenge.creatorId === id) return sendJson(res, 400, { error: "You cannot accept your own challenge." });
		if (challenge.targetId && challenge.targetId !== id) return sendJson(res, 403, { error: "That challenge is for someone else." });
		if ((settlements.get(id) || []).length >= MAX_PENDING_SETTLEMENTS) {
			return sendJson(res, 400, { error: "Your game has not collected its earlier results yet. Keep the game open for a moment." });
		}
		const creator = players.get(challenge.creatorId);
		const creatorName = creator ? creator.vampireName : challenge.creatorName;

		challenges.delete(challenge.id);
		const rollA = rollTwoDice();   // the one who made the challenge
		const rollB = rollTwoDice();   // the one who accepted
		const totalA = rollA[0] + rollA[1];
		const totalB = rollB[0] + rollB[1];
		const outcome = totalA > totalB ? "creator" : totalB > totalA ? "acceptor" : "tie";
		const stake = challenge.stake;
		const bet = stakeText(stake);
		const view = (mine, theirs, opponent, result) => ({ you: mine, them: theirs, opponent, outcome: result, stake });

		// The creator's bet was taken when the challenge was made, so winners get both bets,
		// and in a tie everyone gets their own bet back. The acceptor's bet is settled here.
		if (outcome === "tie") {
			queueSettlement(challenge.creatorId, stake, "Dice: a tie with " + me.vampireName + " (" + totalA + " each). Your bet is returned.", view(rollA, rollB, me.vampireName, "tie"));
			queueSettlement(id, {}, "Dice: a tie with " + creatorName + " (" + totalB + " each). Nobody loses anything.", view(rollB, rollA, creatorName, "tie"));
		} else if (outcome === "creator") {
			queueSettlement(challenge.creatorId, scaled(stake, 2), "Dice: you beat " + me.vampireName + " (" + totalA + " to " + totalB + ") and win " + bet + "!", view(rollA, rollB, me.vampireName, "win"));
			queueSettlement(id, scaled(stake, -1), "Dice: " + creatorName + " beat you (" + totalA + " to " + totalB + "). You lose " + bet + ".", view(rollB, rollA, creatorName, "lose"));
		} else {
			queueSettlement(challenge.creatorId, {}, "Dice: " + me.vampireName + " beat you (" + totalB + " to " + totalA + "). You lose " + bet + ".", view(rollA, rollB, me.vampireName, "lose"));
			queueSettlement(id, stake, "Dice: you beat " + creatorName + " (" + totalB + " to " + totalA + ") and win " + bet + "!", view(rollB, rollA, creatorName, "win"));
		}

		recentMatches.push({
			time: Date.now(), creator: creatorName, acceptor: me.vampireName, stake,
			creatorDice: rollA, acceptorDice: rollB, outcome,
		});
		recentMatches = recentMatches.slice(-RECENT_MATCHES);

		if (outcome !== "tie") {
			const winnerId = outcome === "creator" ? challenge.creatorId : id;
			const winnerName = outcome === "creator" ? creatorName : me.vampireName;
			const loserName = outcome === "creator" ? me.vampireName : creatorName;
			diceWins.set(winnerId, (diceWins.get(winnerId) || 0) + 1);
			if (stakeValue(stake) >= BIG_WIN_VALUE) {
				postChatAnnouncement(winnerName + " just won " + bet + " from " + loserName + " at dice (" +
					Math.max(totalA, totalB) + " to " + Math.min(totalA, totalB) + ")!");
			}
		}
		saveDice();
		return sendJson(res, 200, { ok: true });
	}

	return sendJson(res, 400, { error: "Unknown action" });
}

// ---------- Leaderboard API ----------
// GET /api/leaderboard?limit=20  ->  { players: [{ rank, vampireName, settlementName, level, influence, blood, familiars, diceWins }], total }
// Ranked by level, then influence, then blood. Player ids are never included.
function handleLeaderboard(req, res, url) {
	if (req.method === "OPTIONS") return sendPreflight(res);
	if (req.method !== "GET") {
		res.writeHead(405, { Allow: "GET, OPTIONS" });
		return res.end();
	}
	if (isLeaderboardRateLimited(clientIp(req))) {
		return sendJson(res, 429, { error: "Too many requests. Try again in a moment." });
	}

	const asked = Number.parseInt(url.searchParams.get("limit"), 10);
	const limit = Math.min(Math.max(asked || LEADERBOARD_DEFAULT_ROWS, 1), LEADERBOARD_MAX_ROWS);

	const rows = [...players.entries()].map(([id, p]) => ({
		vampireName: p.vampireName,
		settlementName: p.settlementName,
		level: p.level || 1,
		influence: p.stats.influence,
		blood: p.stats.blood,
		familiars: p.stats.familiars,
		diceWins: diceWins.get(id) || 0,
	}));
	rows.sort((a, b) =>
		b.level - a.level ||
		b.influence - a.influence ||
		b.blood - a.blood ||
		a.vampireName.localeCompare(b.vampireName));

	const top = rows.slice(0, limit).map((row, index) => ({ rank: index + 1, ...row }));
	sendJson(res, 200, { players: top, total: rows.length });
}

// ---------- Static files (the game itself) ----------
const MIME_TYPES = {
	".html": "text/html; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".txt": "text/plain; charset=utf-8",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".svg": "image/svg+xml",
	".ico": "image/x-icon",
	".mp3": "audio/mpeg",
	".wav": "audio/wav",
};

// Things in the project folder that must never be served.
const PRIVATE_NAMES = new Set(["server.js", "server-data", "node_modules", "package.json", "package-lock.json"]);

function resolveStaticPath(pathname) {
	let decoded;
	try {
		decoded = decodeURIComponent(pathname);
	} catch {
		return null;
	}
	if (decoded.includes("\0")) return null;

	const parts = decoded.split(/[\\/]+/).filter(Boolean);
	for (const part of parts) {
		if (part === ".." || part.startsWith(".") || PRIVATE_NAMES.has(part)) return null;
	}

	const full = path.join(ROOT, ...parts);
	if (full !== ROOT && !full.startsWith(ROOT + path.sep)) return null;
	return full;
}

function serveStatic(req, res, url) {
	if (req.method !== "GET" && req.method !== "HEAD") {
		res.writeHead(405, { Allow: "GET, HEAD" });
		return res.end();
	}

	let filePath = resolveStaticPath(url.pathname);
	if (!filePath) {
		res.writeHead(404);
		return res.end("Not found");
	}

	fs.stat(filePath, (error, stats) => {
		if (!error && stats.isDirectory()) {
			filePath = path.join(filePath, "index.html");
			return fs.stat(filePath, (err, st) => (err ? notFound(res) : sendFile(req, res, filePath, st)));
		}
		if (error || !stats.isFile()) return notFound(res);
		sendFile(req, res, filePath, stats);
	});
}

function notFound(res) {
	res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
	res.end("Not found");
}

function sendFile(req, res, filePath, stats) {
	const type = MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
	const headers = { "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": "no-cache" };

	// Range requests let the browser seek inside the music player.
	const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
	if (range && (range[1] || range[2])) {
		let start = range[1] ? Number(range[1]) : stats.size - Number(range[2]);
		let end = range[1] && range[2] ? Number(range[2]) : stats.size - 1;
		start = Math.max(0, start);
		end = Math.min(end, stats.size - 1);
		if (start > end || start >= stats.size) {
			res.writeHead(416, { "Content-Range": `bytes */${stats.size}` });
			return res.end();
		}
		res.writeHead(206, {
			...headers,
			"Content-Range": `bytes ${start}-${end}/${stats.size}`,
			"Content-Length": end - start + 1,
		});
		if (req.method === "HEAD") return res.end();
		return fs.createReadStream(filePath, { start, end }).pipe(res);
	}

	res.writeHead(200, { ...headers, "Content-Length": stats.size });
	if (req.method === "HEAD") return res.end();
	fs.createReadStream(filePath).on("error", () => res.destroy()).pipe(res);
}


// ---------- The underground ----------
// GET /api/underground      -> { dungeons: [ { id, name, min, max, pvp, players: [vampire names] } ] }
// WebSocket /ws/underground -> the fights themselves. The client sends
//      { t: "join", id, dungeon }            once (id = the player's own id, never shown to others)
//      { t: "in", mx, my, aim, claw, fire }  about 20 times a second
//      { t: "leave" }
//   and receives hello / roster / s (snapshots) / reward / helmet / died / error.
// The fights are calculated here (js/underground/world.mjs), so nobody can hit from across the map.
// What a fight earns is sent to the player's browser, which adds it to the player's own storage.
let RULES = null, WORLD = null;
const ugWorlds = new Map();   // dungeon id -> { world, conns: Map(pid -> conn), dungeon }
const ugByPlayer = new Map(); // player id -> conn (one connection per player)
let ugNextPid = 1;
const UG_MAX_CONNECTIONS = 300;
const UG_MAX_PER_IP = 4;
const UG_MAX_MESSAGE = 2048;
const UG_IDLE_MS = 30000;
const ugIpCount = new Map();
const isUndergroundListRateLimited = createRateLimiter(60, 60000);

function wsSend(conn, object) {
	if (conn.closed) return;
	const payload = Buffer.from(JSON.stringify(object));
	wsWrite(conn, 1, payload);
}

function wsWrite(conn, opcode, payload) {
	let header;
	if (payload.length < 126) header = Buffer.from([0x80 | opcode, payload.length]);
	else if (payload.length < 65536) { header = Buffer.alloc(4); header[0] = 0x80 | opcode; header[1] = 126; header.writeUInt16BE(payload.length, 2); }
	else { header = Buffer.alloc(10); header[0] = 0x80 | opcode; header[1] = 127; header.writeBigUInt64BE(BigInt(payload.length), 2); }
	try { conn.socket.write(Buffer.concat([header, payload])); } catch { /* socket is gone */ }
}

function wsClose(conn, code = 1000) {
	if (conn.closed) return;
	const payload = Buffer.alloc(2);
	payload.writeUInt16BE(code, 0);
	wsWrite(conn, 8, payload);
	conn.socket.end();
	ugDrop(conn);
}

function ugDrop(conn) {
	if (conn.closed) return;
	conn.closed = true;
	ugIpCount.set(conn.ip, Math.max(0, (ugIpCount.get(conn.ip) || 1) - 1));
	if (conn.room) {
		conn.room.world.removePlayer(conn.pid);
		conn.room.conns.delete(conn.pid);
		if (conn.room.conns.size === 0) ugWorlds.delete(conn.room.dungeon.id);
		else ugRoster(conn.room);
	}
	if (conn.playerId && ugByPlayer.get(conn.playerId) === conn) ugByPlayer.delete(conn.playerId);
	if (conn.mode === "tavern") tavDrop(conn);
}

function ugRoster(room) {
	const roster = {};
	for (const [pid, c] of room.conns) roster[pid] = { name: c.name, avatar: c.avatar, helmet: c.helmet, level: c.level };
	for (const c of room.conns.values()) wsSend(c, { t: "roster", players: roster });
}

function ugRoom(dungeon) {
	let room = ugWorlds.get(dungeon.id);
	if (room) return room;
	room = { dungeon, conns: new Map() };
	room.world = new WORLD.World(dungeon.id, {
		onKill(pid, monster, reward) {
			const conn = room.conns.get(pid);
			if (conn) wsSend(conn, { t: "reward", ...reward, name: monster.name });
		},
		onHelmet(pid, dungeonId) {
			const conn = room.conns.get(pid);
			const player = conn && players.get(conn.playerId);
			if (!player) return;
			player.helmets = Array.isArray(player.helmets) ? player.helmets : [];
			const isNew = !player.helmets.includes(dungeonId);
			if (isNew) { player.helmets.push(dungeonId); savePlayers(); }
			wsSend(conn, { t: "helmet", dungeon: dungeonId, name: RULES.HELMET_NAMES[dungeonId], isNew, owned: player.helmets });
			postChatAnnouncement(`${player.vampireName} found the ${RULES.HELMET_NAMES[dungeonId]} in ${room.dungeon.name}!`, CRIER_NAME);
		},
		onDeath(pid, by) {
			const conn = room.conns.get(pid);
			if (conn) wsSend(conn, { t: "died", by });
		},
		onPlayerKill(killerPid, victimPid, victimLevel) {
			const conn = room.conns.get(killerPid);
			if (conn) wsSend(conn, { t: "reward", xp: 25 * Math.max(1, victimLevel || 1), name: "a rival vampire" });
		},
	});
	ugWorlds.set(dungeon.id, room);
	return room;
}

function ugJoin(conn, message) {
	if (conn.room) return;
	const id = typeof message.id === "string" ? message.id : "";
	const player = /^[a-f0-9]{32}$/.test(id) ? players.get(id) : null;
	if (!player) return wsSend(conn, { t: "error", error: "Create your vampire first (it has to be saved on the server)." });
	const dungeon = RULES.dungeonById(Number(message.dungeon));
	if (!dungeon) return wsSend(conn, { t: "error", error: "That place does not exist." });
	if (!RULES.canEnter(dungeon, player.level || 1)) return wsSend(conn, { t: "error", error: `You must be level ${dungeon.min} to enter ${dungeon.name}.` });
	const old = ugByPlayer.get(id);
	if (old) wsClose(old, 4000);

	const room = ugRoom(dungeon);
	const profile = player.profile || {};
	const attributes = cleanAttributes(profile.attributes, player.level, null);
	conn.playerId = id;
	conn.pid = String(ugNextPid++);
	conn.name = player.vampireName;
	conn.level = player.level || 1;
	conn.avatar = profile.avatar || null;
	conn.helmet = profile.helmet || 0;
	conn.room = room;
	conn.lastInput = Date.now();
	ugByPlayer.set(id, conn);
	room.conns.set(conn.pid, conn);
	room.world.addPlayer(conn.pid, { name: conn.name, level: conn.level, stats: attributes });
	lastSeen.set(id, Date.now());
	wsSend(conn, { t: "hello", you: conn.pid, dungeon: dungeon.id, name: dungeon.name, pvp: !!dungeon.pvp });
	ugRoster(room);
}

function ugReceive(conn, text) {
	let message;
	try { message = JSON.parse(text); } catch { return; }
	if (!message || typeof message !== "object") return;
	if (conn.mode === "tavern") return tavReceive(conn, message);
	if (message.t === "join") return ugJoin(conn, message);
	if (message.t === "in" && conn.room) {
		conn.lastInput = Date.now();
		conn.room.world.input(conn.pid, message);
	} else if (message.t === "ping") wsSend(conn, { t: "pong", c: message.c });
	else if (message.t === "leave") wsClose(conn);
}

// Parses what the browser sends: masked text frames, pings and closes
function ugParse(conn) {
	for (;;) {
		const b = conn.buffer;
		if (b.length < 2) return;
		const opcode = b[0] & 0x0f;
		const fin = (b[0] & 0x80) !== 0;
		const masked = (b[1] & 0x80) !== 0;
		let length = b[1] & 0x7f;
		let offset = 2;
		if (length === 126) { if (b.length < 4) return; length = b.readUInt16BE(2); offset = 4; }
		else if (length === 127) { if (b.length < 10) return; const big = b.readBigUInt64BE(2); if (big > BigInt(UG_MAX_MESSAGE)) return wsClose(conn, 1009); length = Number(big); offset = 10; }
		if (!masked || length > UG_MAX_MESSAGE || !fin) return wsClose(conn, 1002);
		if (b.length < offset + 4 + length) return;
		const mask = b.subarray(offset, offset + 4);
		const data = Buffer.from(b.subarray(offset + 4, offset + 4 + length));
		for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
		conn.buffer = b.subarray(offset + 4 + length);

		const now = Date.now();
		if (now - conn.windowStart > 1000) { conn.windowStart = now; conn.windowCount = 0; }
		if (++conn.windowCount > 60) return wsClose(conn, 1008);

		if (opcode === 1) ugReceive(conn, data.toString("utf8"));
		else if (opcode === 8) return wsClose(conn);
		else if (opcode === 9) wsWrite(conn, 10, data);
		else if (opcode !== 10) return wsClose(conn, 1003);
		if (conn.closed) return;
	}
}

function onUpgrade(req, socket) {
	const url = new URL(req.url, "http://localhost");
	const key = req.headers["sec-websocket-key"];
	if (!["/ws/underground", "/ws/tavern"].includes(url.pathname) || !key || String(req.headers.upgrade).toLowerCase() !== "websocket" || !RULES) {
		socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
		return;
	}
	const ip = clientIp(req);
	if (ugIpCount.get(ip) >= UG_MAX_PER_IP || [...ugIpCount.values()].reduce((a, b) => a + b, 0) >= UG_MAX_CONNECTIONS) {
		socket.end("HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n");
		return;
	}
	ugIpCount.set(ip, (ugIpCount.get(ip) || 0) + 1);
	const accept = crypto.createHash("sha1").update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
	socket.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + accept + "\r\n\r\n");
	socket.setNoDelay(true);
	const conn = { socket, ip, mode: url.pathname === "/ws/tavern" ? "tavern" : "underground", buffer: Buffer.alloc(0), closed: false, room: null, windowStart: Date.now(), windowCount: 0, lastInput: Date.now() };
	socket.on("data", (chunk) => {
		conn.buffer = Buffer.concat([conn.buffer, chunk]);
		if (conn.buffer.length > UG_MAX_MESSAGE * 4) return wsClose(conn, 1009);
		ugParse(conn);
	});
	socket.on("close", () => ugDrop(conn));
	socket.on("error", () => ugDrop(conn));
	setTimeout(() => { if (!conn.room && !conn.pid) wsClose(conn, 1008); }, 10000).unref();
}

// 20 steps a second for every level that has players in it. The clock is checked every 10 ms and a step is
// taken whenever 50 ms have really passed, so a busy server catches up instead of running in slow motion
// and the pictures leave at an even rhythm.
const UG_STEP_MS = 50; // = 1000 / TICK_RATE in js/underground/world.mjs (WORLD is only loaded after start-up)
let ugLastClock = Date.now(), ugOwed = 0;
setInterval(() => {
	const now = Date.now();
	ugOwed = Math.min(ugOwed + (now - ugLastClock), UG_STEP_MS * 4);
	ugLastClock = now;
	while (ugOwed >= UG_STEP_MS) {
		ugOwed -= UG_STEP_MS;
		ugStep(now);
	}
}, 10);

function ugStep(now) {
	for (const room of ugWorlds.values()) {
		for (const conn of [...room.conns.values()]) {
			if (now - conn.lastInput > UG_IDLE_MS) { wsSend(conn, { t: "error", error: "You were away for too long." }); wsClose(conn, 4001); continue; }
			lastSeen.set(conn.playerId, now);
		}
		if (room.conns.size === 0) continue;
		room.world.step(1 / WORLD.TICK_RATE);
		const snapshot = room.world.snapshot();
		const text = Buffer.from(JSON.stringify(snapshot));
		for (const conn of room.conns.values()) wsWrite(conn, 1, text);
	}
}


// ---------- Friends ----------
// POST /api/friends { id, action, name? }
//   action "list"                     -> { friends: [ { name, online, level } ], incoming: [ { name } ], outgoing: [ { name } ] }
//   action "request", name            -> asks that player to be your friend (if they already asked you, you become friends)
//   action "accept" / "decline", name -> answers a request you got
//   action "cancel", name             -> takes back a request you sent
//   action "remove", name             -> ends a friendship
// Friends are kept by player id in friends.json, so a name change does not break a friendship.
const friendLinks = new Map();    // player id -> Set of friend ids
const friendRequests = new Map(); // player id (who was asked) -> Set of ids (who asked)
const MAX_FRIENDS = 100;
const MAX_OPEN_REQUESTS = 50;
const isFriendsRateLimited = createRateLimiter(90, 60000);

const saveFriends = makeSaver(FRIENDS_FILE, () => ({
	friends: Object.fromEntries([...friendLinks].map(([id, set]) => [id, [...set]])),
	requests: Object.fromEntries([...friendRequests].map(([id, set]) => [id, [...set]])),
}), 1500, 2);

function loadFriends() {
	try {
		const saved = JSON.parse(fs.readFileSync(FRIENDS_FILE, "utf8"));
		for (const [id, list] of Object.entries(saved.friends || {})) if (Array.isArray(list)) friendLinks.set(id, new Set(list));
		for (const [id, list] of Object.entries(saved.requests || {})) if (Array.isArray(list)) friendRequests.set(id, new Set(list));
	} catch {
		// No friends saved yet (or the file is damaged): start empty.
	}
}

function friendsOf(id) {
	let set = friendLinks.get(id);
	if (!set) { set = new Set(); friendLinks.set(id, set); }
	return set;
}

function requestsFor(id) {
	let set = friendRequests.get(id);
	if (!set) { set = new Set(); friendRequests.set(id, set); }
	return set;
}

function friendsView(id) {
	const named = (otherId) => players.get(otherId);
	const friends = [...friendsOf(id)].map((fid) => ({ fid, p: named(fid) })).filter((x) => x.p)
		.map(({ fid, p }) => ({ name: p.vampireName, online: lastSeen.has(fid), level: p.level || 1 }))
		.sort((a, b) => (b.online - a.online) || a.name.localeCompare(b.name));
	const incoming = [...requestsFor(id)].map(named).filter(Boolean).map((p) => ({ name: p.vampireName }));
	const outgoing = [];
	for (const [target, set] of friendRequests) if (set.has(id) && players.get(target)) outgoing.push({ name: players.get(target).vampireName });
	return { friends, incoming, outgoing };
}

async function handleFriends(req, res) {
	if (req.method === "OPTIONS") return sendPreflight(res);
	if (req.method !== "POST") {
		res.writeHead(405, { Allow: "POST, OPTIONS" });
		return res.end();
	}
	if (isFriendsRateLimited(clientIp(req))) return sendJson(res, 429, { error: "Too many requests. Try again in a moment." });
	let body;
	try { body = await readJsonBody(req); } catch (error) { return sendJson(res, error.status || 400, { error: error.message }); }
	body = body && typeof body === "object" ? body : {};
	const id = typeof body.id === "string" ? body.id : "";
	if (!/^[a-f0-9]{32}$/.test(id)) return sendJson(res, 400, { error: "Invalid player id" });
	const me = players.get(id);
	if (!me) return sendJson(res, 403, { error: "The server does not know you yet. Wait a few seconds and try again." });
	lastSeen.set(id, Date.now());

	const action = body.action;
	if (action === "list") return sendJson(res, 200, friendsView(id));

	const wanted = clean(body.name, MAX_NAME_LENGTH);
	const otherId = wanted ? nameOwners.get(nameKey(wanted)) : null;
	const other = otherId ? players.get(otherId) : null;
	if (!other) return sendJson(res, 404, { error: "There is no player called " + (wanted || "that") + "." });
	if (otherId === id) return sendJson(res, 400, { error: "That is you." });
	let message = "";

	if (action === "request") {
		if (friendsOf(id).has(otherId)) return sendJson(res, 400, { error: other.vampireName + " is already your friend." });
		if (requestsFor(id).has(otherId)) {
			// they had already asked: this makes you friends
			requestsFor(id).delete(otherId);
			friendsOf(id).add(otherId); friendsOf(otherId).add(id);
			message = "You and " + other.vampireName + " are now friends.";
		} else if (requestsFor(otherId).has(id)) {
			return sendJson(res, 400, { error: "You already asked " + other.vampireName + "." });
		} else {
			if (friendsOf(id).size >= MAX_FRIENDS) return sendJson(res, 400, { error: "Your friend list is full." });
			if (requestsFor(otherId).size >= MAX_OPEN_REQUESTS) return sendJson(res, 400, { error: other.vampireName + " has too many open requests." });
			requestsFor(otherId).add(id);
			message = "Friend request sent to " + other.vampireName + ".";
			const live = tavByPlayer.get(otherId);
			if (live) wsSend(live, { t: "notice", text: me.vampireName + " would like to be your friend. Open Friends to answer." });
		}
	} else if (action === "accept") {
		if (!requestsFor(id).has(otherId)) return sendJson(res, 400, { error: other.vampireName + " has not asked you." });
		if (friendsOf(id).size >= MAX_FRIENDS) return sendJson(res, 400, { error: "Your friend list is full." });
		requestsFor(id).delete(otherId);
		friendsOf(id).add(otherId); friendsOf(otherId).add(id);
		message = "You and " + other.vampireName + " are now friends.";
	} else if (action === "decline") {
		requestsFor(id).delete(otherId);
		message = "Request declined.";
	} else if (action === "cancel") {
		requestsFor(otherId).delete(id);
		message = "Request taken back.";
	} else if (action === "remove") {
		friendsOf(id).delete(otherId); friendsOf(otherId).delete(id);
		message = other.vampireName + " is no longer your friend.";
	} else {
		return sendJson(res, 400, { error: "Unknown action" });
	}
	saveFriends();
	return sendJson(res, 200, { ok: true, message, ...friendsView(id) });
}

// ---------- The tavern ----------
// WebSocket /ws/tavern: one big room where players meet. No fighting. The client sends
//      { t: "join", id }                         once (id = the player's own id)
//      { t: "move", x, y }                       click on the floor: you stand there at once if the spot is free
//      { t: "say", text }                        Enter: the text shows above your head for a few seconds
//      { t: "tradeRequest", to } { t: "tradeReply", accept } { t: "tradeOffer", offer, have }
//      { t: "tradeAccept", ok, have } { t: "tradeCancel" }
//   and receives hello / join / left / p (a new position) / you (your own position, if a move was refused)
//   / say / notice / tradeRequest / trade / tradeEnd.
// The layout of the room is in js/tavern/layout.mjs (shared with the browser).
// A trade is settled like a dice game: both players' browsers get "settlements" (+/- resources) that they
// apply to their own storage exactly once (see queueSettlement above).
let TAVERN = null;
const tavConns = new Map();    // pid -> conn
const tavByPlayer = new Map(); // player id -> conn
const TAV_MAX_PLAYERS = 150;
const TAV_IDLE_MS = 15 * 60000;
const TRADE_REQUEST_MS = 30000;
const TRADE_IDLE_MS = 5 * 60000;
const tradeOf = new Map();       // player id -> trade (both players point to the same one)
const tradeRequests = new Map(); // player id (who was asked) -> { fromId, timer }

function tavOthers(except) {
	return [...tavConns.values()].filter((c) => c !== except).map((c) => ({ x: c.x, y: c.y }));
}

function tavBroadcast(object, except = null) {
	for (const c of tavConns.values()) if (c !== except) wsSend(c, object);
}

function tavInfo(c) {
	return { name: c.name, avatar: c.avatar, helmet: c.helmet, level: c.level, x: c.x, y: c.y, face: c.face };
}

function tavJoin(conn, message) {
	if (conn.pid) return;
	const id = typeof message.id === "string" ? message.id : "";
	const player = /^[a-f0-9]{32}$/.test(id) ? players.get(id) : null;
	if (!player) return wsSend(conn, { t: "error", error: "Create your vampire first (it has to be saved on the server)." });
	if (tavConns.size >= TAV_MAX_PLAYERS) return wsSend(conn, { t: "error", error: "The tavern is full right now. Try again in a moment." });
	const old = tavByPlayer.get(id);
	if (old) wsClose(old, 4000);

	const profile = player.profile || {};
	conn.playerId = id;
	conn.pid = String(ugNextPid++);
	conn.name = player.vampireName;
	conn.level = player.level || 1;
	conn.avatar = profile.avatar || null;
	conn.helmet = profile.helmet || 0;
	conn.face = 1;
	conn.lastInput = Date.now();
	conn.lastMove = 0; conn.lastSay = 0; conn.lastTradeAsk = 0;
	const spot = TAVERN.freeSpawn(tavOthers(null));
	conn.x = spot.x; conn.y = spot.y;
	tavConns.set(conn.pid, conn);
	tavByPlayer.set(id, conn);
	lastSeen.set(id, Date.now());

	const roster = {};
	for (const [pid, c] of tavConns) roster[pid] = tavInfo(c);
	wsSend(conn, { t: "hello", you: conn.pid, players: roster });
	tavBroadcast({ t: "join", pid: conn.pid, info: tavInfo(conn) }, conn);
}

function tavDrop(conn) {
	if (!conn.pid || tavConns.get(conn.pid) !== conn) return;
	tavConns.delete(conn.pid);
	if (tavByPlayer.get(conn.playerId) === conn) tavByPlayer.delete(conn.playerId);
	endTrade(conn.playerId, conn.name + " left the tavern.");
	const asked = tradeRequests.get(conn.playerId);
	if (asked) { clearTimeout(asked.timer); tradeRequests.delete(conn.playerId); }
	for (const [target, r] of tradeRequests) if (r.fromId === conn.playerId) { clearTimeout(r.timer); tradeRequests.delete(target); }
	tavBroadcast({ t: "left", pid: conn.pid });
}

function tavReceive(conn, message) {
	if (message.t === "join") return tavJoin(conn, message);
	if (!conn.pid) return;
	const now = Date.now();
	conn.lastInput = now;
	lastSeen.set(conn.playerId, now);

	if (message.t === "ping") return wsSend(conn, { t: "pong", c: message.c });
	if (message.t === "leave") return wsClose(conn);

	if (message.t === "move") {
		const x = Math.round(Number(message.x)), y = Math.round(Number(message.y));
		if (!Number.isFinite(x) || !Number.isFinite(y)) return;
		if (now - conn.lastMove < 120) return wsSend(conn, { t: "you", x: conn.x, y: conn.y });
		const problem = TAVERN.spotProblem(x, y, tavOthers(conn));
		if (problem) return wsSend(conn, { t: "you", x: conn.x, y: conn.y, error: problem });
		conn.lastMove = now;
		if (Math.abs(x - conn.x) > 3) conn.face = x > conn.x ? 1 : -1;
		conn.x = x; conn.y = y;
		return tavBroadcast({ t: "p", pid: conn.pid, x, y, face: conn.face }, conn);
	}

	if (message.t === "say") {
		const text = clean(message.text, TAVERN.MAX_SAY);
		if (!text) return;
		if (now - conn.lastSay < 1000) return wsSend(conn, { t: "notice", text: "Not so fast!" });
		if (hasSlur(text)) return wsSend(conn, { t: "notice", text: "That message is not allowed." });
		conn.lastSay = now;
		return tavBroadcast({ t: "say", pid: conn.pid, text });
	}

	if (message.t === "tradeRequest") return tradeAsk(conn, String(message.to));
	if (message.t === "tradeReply") return tradeAnswer(conn, !!message.accept);
	if (message.t === "tradeOffer") return tradeOffer(conn, message);
	if (message.t === "tradeAccept") return tradeAccept(conn, message);
	if (message.t === "tradeCancel") return endTrade(conn.playerId, conn.name + " cancelled the trade.");
}

setInterval(() => {
	const now = Date.now();
	for (const c of [...tavConns.values()]) {
		if (now - c.lastInput > TAV_IDLE_MS) { wsSend(c, { t: "error", error: "You were away for too long." }); wsClose(c, 4001); }
	}
	for (const t of new Set(tradeOf.values())) if (now - t.touched > TRADE_IDLE_MS) endTrade(t.a.playerId, "The trade timed out.");
}, 10000).unref();

// ----- trading -----
// A trade: { a: conn, b: conn, offer: { a: {}, b: {} }, ok: { a, b }, have: { a: {}, b: {} }, touched }
// "have" is what each browser says its player owns (the browser also checks it itself); an offer can never be
// more than that.
function cleanOffer(input) {
	const offer = {};
	if (!input || typeof input !== "object") return offer;
	for (const kind of DICE_RESOURCES) {
		const value = Number(input[kind] || 0);
		if (Number.isInteger(value) && value > 0 && value <= MAX_STAKE) offer[kind] = value;
	}
	return offer;
}

function tradeSide(trade, playerId) { return trade.a.playerId === playerId ? "a" : "b"; }

function tradeView(trade, side) {
	const other = side === "a" ? "b" : "a";
	const partner = trade[other];
	return { t: "trade", with: { pid: partner.pid, name: partner.name }, mine: trade.offer[side], theirs: trade.offer[other], myOk: trade.ok[side], theirOk: trade.ok[other] };
}

function tradeSend(trade) {
	wsSend(trade.a, tradeView(trade, "a"));
	wsSend(trade.b, tradeView(trade, "b"));
}

function endTrade(playerId, reason, done = false) {
	const trade = tradeOf.get(playerId);
	if (!trade) return;
	tradeOf.delete(trade.a.playerId); tradeOf.delete(trade.b.playerId);
	wsSend(trade.a, { t: "tradeEnd", done, reason });
	wsSend(trade.b, { t: "tradeEnd", done, reason });
}

function tradeAsk(conn, toPid) {
	const target = tavConns.get(toPid);
	const now = Date.now();
	if (!target || target === conn) return;
	if (now - conn.lastTradeAsk < 4000) return wsSend(conn, { t: "notice", text: "Wait a moment before asking again." });
	if (tradeOf.has(conn.playerId)) return wsSend(conn, { t: "notice", text: "You are already trading." });
	if (tradeOf.has(target.playerId) || tradeRequests.has(target.playerId)) return wsSend(conn, { t: "notice", text: target.name + " is busy with another trade." });
	conn.lastTradeAsk = now;
	const timer = setTimeout(() => {
		const r = tradeRequests.get(target.playerId);
		if (r && r.fromId === conn.playerId) {
			tradeRequests.delete(target.playerId);
			wsSend(conn, { t: "notice", text: target.name + " did not answer your trade request." });
			wsSend(target, { t: "tradeRequestEnd" });
		}
	}, TRADE_REQUEST_MS);
	timer.unref();
	tradeRequests.set(target.playerId, { fromId: conn.playerId, timer });
	wsSend(target, { t: "tradeRequest", from: conn.pid, name: conn.name });
	wsSend(conn, { t: "notice", text: "Trade request sent to " + target.name + "." });
}

function tradeAnswer(conn, accept) {
	const request = tradeRequests.get(conn.playerId);
	if (!request) return;
	clearTimeout(request.timer);
	tradeRequests.delete(conn.playerId);
	const from = tavByPlayer.get(request.fromId);
	if (!from) return;
	if (!accept) return wsSend(from, { t: "notice", text: conn.name + " does not want to trade." });
	if (tradeOf.has(from.playerId) || tradeOf.has(conn.playerId)) return;
	const trade = { a: from, b: conn, offer: { a: {}, b: {} }, ok: { a: false, b: false }, have: { a: {}, b: {} }, touched: Date.now() };
	tradeOf.set(from.playerId, trade);
	tradeOf.set(conn.playerId, trade);
	tradeSend(trade);
}

function tradeOffer(conn, message) {
	const trade = tradeOf.get(conn.playerId);
	if (!trade) return;
	const side = tradeSide(trade, conn.playerId);
	trade.have[side] = cleanOffer(message.have);
	const offer = cleanOffer(message.offer);
	for (const kind of Object.keys(offer)) if (offer[kind] > (trade.have[side][kind] || 0)) offer[kind] = trade.have[side][kind] || 0;
	for (const kind of Object.keys(offer)) if (!offer[kind]) delete offer[kind];
	trade.offer[side] = offer;
	trade.ok.a = false; trade.ok.b = false;   // any change means both have to agree again
	trade.touched = Date.now();
	tradeSend(trade);
}

function tradeAccept(conn, message) {
	const trade = tradeOf.get(conn.playerId);
	if (!trade) return;
	const side = tradeSide(trade, conn.playerId);
	trade.have[side] = cleanOffer(message.have);
	trade.touched = Date.now();
	if (!message.ok) { trade.ok[side] = false; return tradeSend(trade); }
	for (const kind of Object.keys(trade.offer[side])) {
		if (trade.offer[side][kind] > (trade.have[side][kind] || 0)) {
			trade.ok[side] = false; tradeSend(trade);
			return wsSend(conn, { t: "notice", text: "You do not have that much " + DICE_RESOURCE_NAMES[kind] + "." });
		}
	}
	trade.ok[side] = true;
	if (!(trade.ok.a && trade.ok.b)) return tradeSend(trade);

	// both agreed: settle it
	const { a, b } = trade, offerA = trade.offer.a, offerB = trade.offer.b;
	if (!Object.keys(offerA).length && !Object.keys(offerB).length) { trade.ok.a = trade.ok.b = false; tradeSend(trade); return wsSend(conn, { t: "notice", text: "Nothing is offered yet." }); }
	if ((settlements.get(a.playerId) || []).length >= MAX_PENDING_SETTLEMENTS || (settlements.get(b.playerId) || []).length >= MAX_PENDING_SETTLEMENTS) {
		trade.ok.a = trade.ok.b = false; tradeSend(trade);
		return wsSend(conn, { t: "notice", text: "A game has not collected its earlier results yet. Try again in a moment." });
	}
	const delta = (give, get) => {
		const d = {};
		for (const [k, n] of Object.entries(give)) d[k] = (d[k] || 0) - n;
		for (const [k, n] of Object.entries(get)) d[k] = (d[k] || 0) + n;
		return d;
	};
	const said = (offer) => Object.keys(offer).length ? stakeText(offer) : "nothing";
	queueSettlement(a.playerId, delta(offerA, offerB), "Trade with " + b.name + ": you gave " + said(offerA) + " and got " + said(offerB) + ".");
	queueSettlement(b.playerId, delta(offerB, offerA), "Trade with " + a.name + ": you gave " + said(offerB) + " and got " + said(offerA) + ".");
	saveDice();
	endTrade(a.playerId, "Trade complete.", true);
}

function handleUndergroundList(req, res) {
	if (req.method === "OPTIONS") return sendPreflight(res);
	if (isUndergroundListRateLimited(clientIp(req))) return sendJson(res, 429, { error: "Too many requests. Try again in a moment." });
	const dungeons = RULES.DUNGEONS.map((d) => {
		const room = ugWorlds.get(d.id);
		return { id: d.id, name: d.name, min: d.min, max: d.max, pvp: !!d.pvp, players: room ? [...room.conns.values()].map((c) => c.name).slice(0, 50) : [] };
	});
	return sendJson(res, 200, { dungeons });
}

// ---------- Start ----------
const server = http.createServer((req, res) => {
	const url = new URL(req.url, "http://localhost");
	const api = {
		"/api/chat": () => handleChat(req, res, url),
		"/api/player": () => handlePlayer(req, res),
		"/api/profile": () => handleProfile(req, res, url),
		"/api/leaderboard": async () => handleLeaderboard(req, res, url),
		"/api/online": () => handleOnline(req, res),
		"/api/dice": () => handleDice(req, res),
		"/api/friends": () => handleFriends(req, res),
		"/api/underground": async () => handleUndergroundList(req, res),
	}[url.pathname];
	if (api) {
		api().catch((error) => {
			console.error(error);
			if (!res.headersSent) sendJson(res, 500, { error: "Server error" });
		});
	} else {
		serveStatic(req, res, url);
	}
});
server.on("upgrade", onUpgrade);

loadMessages();
loadPlayers();
loadDice();
loadFriends();

// The shared rules are ES modules; this file is not, so they are loaded with import() before starting.
Promise.all([import("./js/rules.mjs"), import("./js/underground/world.mjs"), import("./js/tavern/layout.mjs")]).then(([rules, world, tavern]) => {
RULES = rules;
WORLD = world;
TAVERN = tavern;
server.listen(PORT, HOST, () => {
	console.log("Vampire House is running.");
	console.log(`  On this computer:  http://localhost:${PORT}`);
	for (const addresses of Object.values(os.networkInterfaces())) {
		for (const a of addresses || []) {
			if (a.family === "IPv4" && !a.internal) console.log(`  On your network:   http://${a.address}:${PORT}`);
		}
	}
	console.log("Press Ctrl+C to stop.");
});
}).catch((error) => { console.error("Could not load js/rules.mjs, js/underground/world.mjs and js/tavern/layout.mjs. Upload the whole game folder.", error); process.exit(1); });
