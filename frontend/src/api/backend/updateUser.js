import * as api from "./base";

export async function updateUser(item) {
	// Remove readonly fields
	const { id, ...data } = item;

	return await api.put({
		url: `/users/${id}`,
		data,
	});
}
