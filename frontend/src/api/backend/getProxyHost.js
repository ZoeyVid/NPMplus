import * as api from "./base";

export async function getProxyHost(id, expand, params = {}) {
	return await api.get({
		url: `/nginx/proxy-hosts/${id}`,
		params: {
			expand: expand?.join(","),
			...params,
		},
	});
}
