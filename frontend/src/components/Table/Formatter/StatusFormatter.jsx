import cn from "clsx";
import { T } from "src/locale";
import { showNginxErrorModal } from "src/modals";

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

	const status = (
		<span className={cn("status", `status-${color}`)} title={nginxErr}>
			<span className="status-dot status-dot-animated" />
			<T id={label} />
		</span>
	);

	if (enabled && !nginxOnline) {
		return (
			<button
				type="button"
				className="p-0 border-0 bg-transparent"
				onClick={() => showNginxErrorModal(nginxErr)}
			>
				{status}
			</button>
		);
	}

	return status;
}
