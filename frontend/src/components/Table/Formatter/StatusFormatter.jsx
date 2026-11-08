import cn from "clsx";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import Popover from "react-bootstrap/Popover";
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
		<span className={cn("status", `status-${color}`)}>
			<span className="status-dot status-dot-animated" />
			<T id={label} />
		</span>
	);

	if (enabled && !nginxOnline) {
		return (
			<OverlayTrigger
				placement="top"
				overlay={
					<Popover>
						<Popover.Body>
							<T id="action.view-details" />
						</Popover.Body>
					</Popover>
				}
			>
				<button
					type="button"
					className="p-0 border-0 bg-transparent"
					onClick={() => showNginxErrorModal(nginxErr)}
				>
					{status}
				</button>
			</OverlayTrigger>
		);
	}

	return status;
}
