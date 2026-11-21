// Vampire House server: serves the game and runs the chat.
// Zero dependencies. Start it with:  node server.js   (needs Node.js 18 or newer)
//
// Settings (all optional, set as environment variables):
//   PORT           port to listen on                       (default 8000)
//   HOST           address to listen on                    (default 0.0.0.0)
//   TRUST_PROXY    set to 1 if you run behind a reverse proxy, so the real
//                  visitor IP is used for rate limiting    (default off)

const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PORT = Number(process.env.PORT) || 8000;
const HOST = process.env.HOST || "0.0.0.0";
const TRUST_PROXY = process.env.TRUST_PROXY === "1";

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "server-data");
const CHAT_FILE = path.join(DATA_DIR, "chat.json");

// ---------- Chat limits ----------
const MAX_STORED_MESSAGES = 200;   // older messages are dropped
const FIRST_LOAD_MESSAGES = 50;    // what a brand new visitor sees
const MAX_NAME_LENGTH = 20;
const MAX_TEXT_LENGTH = 300;
const MAX_BODY_BYTES = 4 * 1024;
const RATE_LIMIT_COUNT = 5;        // messages ...
const RATE_LIMIT_WINDOW_MS = 10000; // ... per 10 seconds per visitor

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

let saveTimer = null;
function saveSoon() {
	if (saveTimer) return;
	saveTimer = setTimeout(() => {
		saveTimer = null;
		try {
			fs.mkdirSync(DATA_DIR, { recursive: true });
			const temp = CHAT_FILE + ".tmp";
			fs.writeFileSync(temp, JSON.stringify({ messages }));
			fs.renameSync(temp, CHAT_FILE); // swap in one step so the file is never half-written
		} catch (error) {
			console.error("Could not save chat:", error.message);
		}
	}, 500);
}

// Remove control characters, squash whitespace, cut to length (by character, not byte).
function clean(value, maxLength) {
	if (typeof value !== "string") return "";
	const text = value.replace(/[\u0000-\u001F\u007F-\u009F\u2028\u2029]/g, " ").replace(/\s+/g, " ").trim();
	return Array.from(text).slice(0, maxLength).join("");
}

// ---------- Rate limiting ----------
const recentPosts = new Map(); // ip -> timestamps

function isRateLimited(ip) {
	const now = Date.now();
	const stamps = (recentPosts.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
	if (stamps.length >= RATE_LIMIT_COUNT) {
		recentPosts.set(ip, stamps);
		return true;
	}
	stamps.push(now);
	recentPosts.set(ip, stamps);
	return false;
}

setInterval(() => {
	const now = Date.now();
	for (const [ip, stamps] of recentPosts) {
		if (stamps.every((t) => now - t >= RATE_LIMIT_WINDOW_MS)) recentPosts.delete(ip);
	}
}, 60000).unref();

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

// ---------- Chat API ----------
async function handleChat(req, res, url) {
	if (req.method === "OPTIONS") {
		res.writeHead(204, {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type",
			"Access-Control-Max-Age": "86400",
		});
		return res.end();
	}

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

		if (isRateLimited(clientIp(req))) {
			return sendJson(res, 429, { error: "You are sending messages too fast. Wait a few seconds." });
		}

		const message = { id: nextId++, name, text, time: Date.now() };
		messages.push(message);
		if (messages.length > MAX_STORED_MESSAGES) messages = messages.slice(-MAX_STORED_MESSAGES);
		saveSoon();
		return sendJson(res, 201, { message });
	}

	res.writeHead(405, { Allow: "GET, POST, OPTIONS" });
	res.end();
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
	if (url.pathname === "/api/chat") {
		handleChat(req, res, url).catch((error) => {
			console.error(error);
			if (!res.headersSent) sendJson(res, 500, { error: "Server error" });
		});
	} else {
		serveStatic(req, res, url);
	}
});

loadMessages();

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
