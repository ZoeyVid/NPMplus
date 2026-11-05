import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import Popover from "react-bootstrap/Popover";
import { intl } from "src/locale";
import { showAccessListModal } from "src/modals";

export function AccessListFormatter({ proxyHostId, access, type, locations }) {
	const hasLocationAcls = locations.some((loc) => loc.accessLists.length > 0);

	let triggerLabel =
		type === "custom"
			? intl.formatMessage({ id: "access-list.custom" })
			: intl.formatMessage({ id: "access-list.public" });

	if (access.length === 1) {
		triggerLabel = access[0].name;
	}
	const popover = (
		<Popover id={`access-list-popover-${proxyHostId}`}>
			<Popover.Body>
				{access.map((acl) => (
					<div key={acl.id}>{acl.name}</div>
				))}
			</Popover.Body>
		</Popover>
	);

	const label = hasLocationAcls ? <strong>{triggerLabel}</strong> : triggerLabel;

	if (access.length === 1) {
		return (
			<button
				type="button"
				className="btn btn-link p-0 border-0 text-decoration-none align-baseline"
				onClick={(e) => {
					e.preventDefault();
					showAccessListModal(access[0].id);
				}}
			>
				{label}
			</button>
		);
	}
	if (access.length > 1) {
		return (
			<OverlayTrigger placement="bottom" overlay={popover}>
				<button type="button" className="p-0 border-0 bg-transparent text-reset">
					{label}
				</button>
			</OverlayTrigger>
		);
	}
	return label;
}
