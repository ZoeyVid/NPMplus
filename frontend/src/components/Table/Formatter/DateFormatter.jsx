import cn from "clsx";
import { formatDateTime } from "src/locale";

export function DateFormatter({ value }) {
	return <span className={cn({ "text-danger": Date.parse(value) < Date.now() })}>{formatDateTime(value)}</span>;
}
