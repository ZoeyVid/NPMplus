import * as api from "./base";

export async function deleteStream(id) {
	return await api.del({
		url: `/nginx/streams/${id}`,
	});
}
