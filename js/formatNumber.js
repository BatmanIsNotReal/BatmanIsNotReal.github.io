// Easy-to-read numbers: 999 -> 999, 1500 -> 1.5k, 100000 -> 100k, 1234567 -> 1.2M, 2000000000 -> 2B.
// Rounds down (never shows more than the player really has) and shows at most one decimal.

const UNITS = ["", "k", "M", "B", "T", "Qa", "Qi"];

export default function formatNumber(value) {
	value = Math.floor(Number(value) || 0);
	if (value < 1000) return String(value);

	let unit = 0;
	let size = 1; // 1000 ** unit
	while (value >= size * 1000 && unit < UNITS.length - 1) {
		size *= 1000;
		unit++;
	}
	const tenths = Math.floor(value / (size / 10)); // whole numbers only: no floating point surprises
	const text = String(tenths / 10);   // 1.25 -> 1.2, 100 -> 100
	return text + UNITS[unit];
}

// Income per 10 seconds: small values keep one decimal (0.1, 0.3, 12.5), big ones are short like storage (659.3k).
// 659322.4999 -> 659.3k; 0.30000000000000004 -> 0.3
export function formatRate(value) {
	value = Number(value) || 0;
	if (value >= 1000) return formatNumber(value);
	return String(Math.round(value * 10) / 10);
}
