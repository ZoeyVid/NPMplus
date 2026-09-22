import cn from "clsx";
import { differenceInDays, isPast } from "date-fns";
import { formatDateTime, parseDate } from "src/locale";

export function DateFormatter({ value, highlightPast, highlightNearlyExpired }) {
	const d = parseDate(value);
	const dateIsPast = d ? isPast(d) : false;
	const days = d ? differenceInDays(d, new Date()) : 0;
	const cl = cn({
		"text-danger": highlightPast && dateIsPast,
		"text-warning": highlightNearlyExpired && !dateIsPast && days <= 30 && days >= 0,
	});
	return <span className={cl}>{formatDateTime(value)}</span>;
}
