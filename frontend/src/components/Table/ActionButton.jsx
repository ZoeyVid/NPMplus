import { IconEdit, IconEye } from "@tabler/icons-react";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import Tooltip from "react-bootstrap/Tooltip";
import { useUser } from "src/hooks";
import { intl } from "src/locale";
import { hasPermission, MANAGE } from "src/modules/Permissions";

export function ActionButton({ icon: Icon, label, onClick }) {
	const text = intl.formatMessage({ id: label });
	return (
		<OverlayTrigger placement="top" overlay={<Tooltip>{text}</Tooltip>}>
			<button type="button" className="btn btn-action btn-sm px-1" onClick={onClick}>
				<Icon />
			</button>
		</OverlayTrigger>
	);
}

export function EditButton({ section, onClick }) {
	const { data } = useUser("me");
	const canManage = hasPermission(section, MANAGE, data?.permissions, data?.npmplusIsAdmin);
	return (
		<ActionButton
			icon={canManage ? IconEdit : IconEye}
			label={canManage ? "action.edit" : "action.view-details"}
			onClick={onClick}
		/>
	);
}
