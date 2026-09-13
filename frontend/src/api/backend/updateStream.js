import * as api from "./base";

export async function updateStream(item) {
	// Remove readonly fields
	const { id, createdOn: _, modifiedOn: __, ...data } = item;

	return await api.put({
		url: `/nginx/streams/${id}`,
		data,
	});
}
