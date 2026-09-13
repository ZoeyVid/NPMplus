import * as api from "./base";

export async function toggleProxyHost(id, enabled) {
	return await api.post({
		url: `/nginx/proxy-hosts/${id}/${enabled ? "enable" : "disable"}`,
	});
}
