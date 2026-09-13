import * as api from "./base";

export async function getAccessLists(expand, params = {}) {
	return await api.get({
		url: "/nginx/access-lists",
		params: {
			expand: expand?.join(","),
			...params,
		},
	});
}
