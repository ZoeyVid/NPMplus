import * as api from "./base";

export async function deleteProxyHost(id) {
	return await api.del({
		url: `/nginx/proxy-hosts/${id}`,
	});
}
