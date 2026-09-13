import * as api from "./base";

export async function updateSetting(item) {
	// Remove readonly fields
	const { id, ...data } = item;

	return await api.put({
		url: `/settings/${id}`,
		data,
	});
}
