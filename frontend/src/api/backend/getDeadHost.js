import * as api from "./base";

export async function getDeadHost(id, expand, params = {}) {
	return await api.get({
		url: `/nginx/dead-hosts/${id}`,
		params: {
			expand: expand?.join(","),
			...params,
		},
	});
}
