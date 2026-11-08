import { IconEdit, IconEye } from "@tabler/icons-react";
import { useUser } from "src/hooks";
import { intl } from "src/locale";
import { hasPermission, MANAGE } from "src/modules/Permissions";

export function ActionButton({ icon: Icon, label, onClick }) {
	const text = intl.formatMessage({ id: label });
	return (
		<button type="button" title={text} className="btn btn-action btn-sm px-1" onClick={onClick}>
			<Icon />
		</button>
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
