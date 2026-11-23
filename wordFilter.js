// A very basic filter for racial slurs, used on names and profile text.
//
// It catches the plain word, upper/lower case, accents, letters swapped for look-alike
// numbers and symbols (n1gger, n!gga, @ for a), spaces or dots between the letters, and
// stretched letters. It is not perfect and is not meant to be: a determined person can
// always find a way round a word list.
//
// The words are stored ROT13-encoded only so this file does not itself read as a list of slurs.
// To add a word: run  node wordFilter.js add <word>  and paste the printed text into the right list.

const rot13 = (text) => text.replace(/[a-z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 97 + 13) % 26) + 97));

// Long words: caught even when hidden inside other letters or spread out with spaces.
const LONG = ["avttre", "avttn", "jrgonpx", "enturnq", "gbjryurnq", "wvtnobb", "mvccreurnq", "cbepuzbaxrl", "fnaqavttre", "puvanzna"].map(rot13);
// Short words: only caught as a whole word, so ordinary words that contain them are safe.
const SHORT = ["puvax", "tbbx", "fcvp", "xvxr", "pbba", "cnxv", "ornare", "qnexvr"].map(rot13);
// Innocent words that contain a long word.
const SAFE = ["snigger"];

// Each long word becomes a pattern where any letter may be stretched: "nigger" -> n+i+g{2,}e+r+
const PATTERNS = LONG.map((word) => new RegExp(word.replace(/(.)\1*/g, (run, c) => `${c}{${run.length},}`)));

const LOOKALIKES = { "0": "o", "1": "i", "!": "i", "|": "i", "3": "e", "4": "a", "@": "a", "$": "s", "5": "s", "7": "t", "+": "t", "¡": "i" };

function normalise(text) {
	return String(text)
		.normalize("NFKD")
		.replace(/\p{M}/gu, "")
		.toLowerCase()
		.replace(/[0134-57@$!|+¡]/g, (c) => LOOKALIKES[c])
		.replace(/(.)\1{2,}/gsu, "$1$1"); // "niiiigger" -> "niigger"
}

function hasSlur(text) {
	const flat = normalise(text);
	const tokens = flat.split(/[^a-z]+/).filter(Boolean);
	for (const token of tokens) {
		const bare = token.replace(/s$/, "");
		if (SHORT.includes(token) || SHORT.includes(bare) || LONG.includes(token) || LONG.includes(bare)) return true;
	}
	let squashed = flat.replace(/[^a-z]/g, "");
	for (const word of SAFE) squashed = squashed.split(word).join("");
	return PATTERNS.some((pattern) => pattern.test(squashed));
}

module.exports = { hasSlur };

if (require.main === module && process.argv[2] === "add" && process.argv[3]) {
	console.log(rot13(process.argv[3].toLowerCase()));
}
