import cn from "clsx";
import { isPast, parseISO } from "date-fns";
import { formatDateTime } from "src/locale";

export function DateFormatter({ value }) {
	return <span className={cn({ "text-danger": isPast(parseISO(value)) })}>{formatDateTime(value)}</span>;
}
