import { fromUnixTime, intlFormat, parseISO } from "date-fns";
import { currentLocale } from "./IntlProvider.jsx";

const parseDate = (value) => {
	const date = typeof value === "number" ? fromUnixTime(value) : parseISO(`${value}`);
	return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateTime = (value) => {
	const d = parseDate(value);
	if (!d) return `${value}`;
	return intlFormat(
		d,
		{
			dateStyle: "medium",
			timeStyle: "medium",
			hourCycle: "h23",
		},
		{ locale: currentLocale },
	);
};

export { formatDateTime, parseDate };
