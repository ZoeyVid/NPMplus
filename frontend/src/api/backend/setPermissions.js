import * as api from "./base";

export async function setPermissions(userId, data) {
	// Remove readonly fields
	return await api.put({
		url: `/users/${userId}/permissions`,
		data,
	});
}
