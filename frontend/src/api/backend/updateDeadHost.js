import * as api from "./base";

export async function updateDeadHost(item) {
	// Remove readonly fields
	const { id, ...data } = item;

	return await api.put({
		url: `/nginx/dead-hosts/${id}`,
		data,
	});
}
