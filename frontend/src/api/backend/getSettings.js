import * as api from "./base";

export async function getSettings(expand, params = {}) {
	return await api.get({
		url: "/settings",
		params: {
			expand: expand?.join(","),
			...params,
		},
	});
}
