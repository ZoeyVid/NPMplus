import type { AccessList, ProxyLocation } from "src/api/backend";
import { intl } from "src/locale";
import { showAccessListModal, showProxyHostModal } from "src/modals";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import Popover from "react-bootstrap/Popover";

interface Props {
	access?: AccessList[];
	type?: ProxyLocation["npmplusAccessListType"];
	locations?: ProxyLocation[];
	proxyHostId: number;
}
export function AccessListFormatter({ proxyHostId, access = [], type = "public", locations = [] }: Props) {
	const hasLocationAcls =
		(locations || []).filter(
			(loc) => loc.npmplusAccessListType === "custom" && (loc.npmplusAccessListIds || []).length > 0,
		).length > 0;

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

	const button = (
		<button
			type="button"
			className="btn btn-link p-0 border-0 text-decoration-none align-baseline"
			aria-label={triggerLabel}
			onClick={(e) => {
				e.preventDefault();
				if (access.length === 1) {
					showAccessListModal(access[0].id || 0);
				} else {
					showProxyHostModal(proxyHostId);
				}
			}}
		>
			{hasLocationAcls ? <strong>{triggerLabel}</strong> : triggerLabel}
		</button>
	);
	return access.length > 1 ? (
		<OverlayTrigger trigger={["hover", "focus"]} placement="bottom" overlay={popover}>
			{button}
		</OverlayTrigger>
	) : (
		button
	);
}
