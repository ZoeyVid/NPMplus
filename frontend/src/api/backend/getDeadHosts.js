import * as api from "./base";

export async function getDeadHosts(expand, params = {}) {
	return await api.get({
		url: "/nginx/dead-hosts",
		params: {
			expand: expand?.join(","),
			...params,
		},
	});
}
