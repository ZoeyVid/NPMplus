import * as api from "./base";

export async function updateRedirectionHost(item) {
	// Remove readonly fields
	const { id, createdOn: _, modifiedOn: __, ...data } = item;

	return await api.put({
		url: `/nginx/redirection-hosts/${id}`,
		data,
	});
}
