import * as api from "./base";

export async function getUsers(expand, params = {}) {
	return await api.get({
		url: "/users",
		params: {
			expand: expand?.join(","),
			...params,
		},
	});
}
