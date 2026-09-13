import * as api from "./base";

export async function deleteUser(id) {
	return await api.del({
		url: `/users/${id}`,
	});
}
