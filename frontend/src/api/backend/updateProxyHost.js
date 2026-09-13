import * as api from "./base";

export async function updateProxyHost(item) {
	// Remove readonly fields
	const { id, createdOn: _, modifiedOn: __, ...data } = item;

	return await api.put({
		url: `/nginx/proxy-hosts/${id}`,
		data,
	});
}
