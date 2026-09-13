import * as api from "./base";

export async function deleteDeadHost(id) {
	return await api.del({
		url: `/nginx/dead-hosts/${id}`,
	});
}
