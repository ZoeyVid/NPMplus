import * as api from "./base";

export async function createRedirectionHost(item) {
	return await api.post({
		url: "/nginx/redirection-hosts",
		data: item,
	});
}
