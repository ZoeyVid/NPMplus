import * as api from "./base";

export async function getRedirectionHosts(expand, params = {}) {
	return await api.get({
		url: "/nginx/redirection-hosts",
		params: {
			expand: expand?.join(","),
			...params,
		},
	});
}
