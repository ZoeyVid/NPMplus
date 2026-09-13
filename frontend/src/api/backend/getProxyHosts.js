import * as api from "./base";

export async function getProxyHosts(expand, params = {}) {
	return await api.get({
		url: "/nginx/proxy-hosts",
		params: {
			expand: expand?.join(","),
			...params,
		},
	});
}
