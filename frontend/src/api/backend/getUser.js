import * as api from "./base";

export async function getUser(id, expand, params = {}) {
	const userId = id ? id : "me";
	return await api.get({
		url: `/users/${userId}`,
		params: {
			expand: expand?.join(","),
			...params,
		},
	});
}
