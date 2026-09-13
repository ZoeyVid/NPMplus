import * as api from "./base";

export async function deleteAccessList(id) {
	return await api.del({
		url: `/nginx/access-lists/${id}`,
	});
}
