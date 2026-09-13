import * as api from "./base";

export async function getRedirectionHost(id, expand, params = {}) {
	return await api.get({
		url: `/nginx/redirection-hosts/${id}`,
		params: {
			expand: expand?.join(","),
			...params,
		},
	});
}
