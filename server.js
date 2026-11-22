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

const PORT = Number(process.env.PORT) || 8000;
const HOST = process.env.HOST || "0.0.0.0";
const TRUST_PROXY = process.env.TRUST_PROXY === "1";

const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "server-data");
const CHAT_FILE = path.join(DATA_DIR, "chat.json");
const PLAYERS_FILE = path.join(DATA_DIR, "players.json");
const DICE_FILE = path.join(DATA_DIR, "dice.json");

// ---------- Chat limits ----------
const MAX_STORED_MESSAGES = 200;   // older messages are dropped
const FIRST_LOAD_MESSAGES = 50;    // what a brand new visitor sees
const MAX_NAME_LENGTH = 20;
const MAX_TEXT_LENGTH = 300;
const MAX_BODY_BYTES = 4 * 1024;
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

function readJsonBody(req) {
	return new Promise((resolve, reject) => {
		let size = 0;
		let tooBig = false;
		const chunks = [];
		req.on("data", (chunk) => {
			if (tooBig) return; // keep draining, but ignore the rest of an oversized upload
			size += chunk.length;
			if (size > MAX_BODY_BYTES) {
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
	});
	savePlayers();
	return sendJson(res, 200, { ok: true });
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

// ---------- Start ----------
const server = http.createServer((req, res) => {
	const url = new URL(req.url, "http://localhost");
	const api = {
		"/api/chat": () => handleChat(req, res, url),
		"/api/player": () => handlePlayer(req, res),
		"/api/leaderboard": async () => handleLeaderboard(req, res, url),
		"/api/online": () => handleOnline(req, res),
		"/api/dice": () => handleDice(req, res),
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

loadMessages();
loadPlayers();
loadDice();

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
