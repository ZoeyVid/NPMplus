import * as api from "./base";

export async function updateAccessList(item) {
	// Remove readonly fields
	const { id, createdOn: _, modifiedOn: __, ...data } = item;

	return await api.put({
		url: `/nginx/access-lists/${id}`,
		data,
	});
}
