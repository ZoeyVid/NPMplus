import * as api from "./base";

export async function getUser(id, expand, params = {}) {
	return await api.get({
		url: `/users/${id}`,
		params: {
			expand: expand?.join(","),
			...params,
		},
	});
}
