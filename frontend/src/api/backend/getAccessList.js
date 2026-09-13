import * as api from "./base";

export async function getAccessList(id, expand, params = {}) {
	return await api.get({
		url: `/nginx/access-lists/${id}`,
		params: {
			expand: expand?.join(","),
			...params,
		},
	});
}
