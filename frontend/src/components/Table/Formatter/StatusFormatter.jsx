import cn from "clsx";
import { T } from "src/locale";

export function StatusFormatter({ enabled, nginxOnline, nginxErr }) {
	let color = "red";
	let label = "offline";

	if (!enabled) {
		color = "orange";
		label = "disabled";
	} else if (nginxOnline) {
		color = "lime";
		label = "online";
	}

	return (
		<span className={cn("status", `status-${color}`)} title={nginxErr ? nginxErr : undefined}>
			<span className="status-dot status-dot-animated" />
			<T id={label} />
		</span>
	);
}
