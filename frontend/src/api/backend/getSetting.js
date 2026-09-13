import * as api from "./base";

export async function getSetting(id, expand, params = {}) {
	return await api.get({
		url: `/settings/${id}`,
		params: {
			expand: expand?.join(","),
			...params,
		},
	});
}
