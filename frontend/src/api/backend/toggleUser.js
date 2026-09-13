import { updateUser } from "./updateUser";

export async function toggleUser(id, enabled) {
	await updateUser({
		id,
		isDisabled: !enabled,
	});
	return true;
}
