import * as api from "./base";

export async function createProxyHost(item) {
	return await api.post({
		url: "/nginx/proxy-hosts",
		data: item,
	});
}
