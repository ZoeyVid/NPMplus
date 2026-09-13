import { fromUnixTime, intlFormat, parseISO } from "date-fns";

const isUnixTimestamp = (value) => {
	if (typeof value !== "number" && typeof value !== "string") return false;
	const num = Number(value);
	if (!Number.isFinite(num)) return false;
	// Check plausible Unix timestamp range: from 1970 to ~year 3000
	// Support both seconds and milliseconds
	if (num > 0 && num < 10000000000) return true; // seconds (<= 10 digits)
	if (num >= 10000000000 && num < 32503680000000) return true; // milliseconds (<= 13 digits)
	return false;
};

const parseDate = (value) => {
	if (typeof value !== "number" && typeof value !== "string") return null;
	const date = isUnixTimestamp(value) ? fromUnixTime(Number(value)) : parseISO(`${value}`);
	return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateTime = (value, locale = "en-US") => {
	const d = parseDate(value);
	if (!d) return `${value}`;
	return intlFormat(
		d,
		{
			dateStyle: "medium",
			timeStyle: "medium",
			hourCycle: "h23",
		},
		{ locale },
	);
};

export { formatDateTime, parseDate };
