import * as api from "./base";

export async function updateProxyHost(item) {
	// Remove readonly fields
	const { id, ...data } = item;

	return await api.put({
		url: `/nginx/proxy-hosts/${id}`,
		data,
	});
}
