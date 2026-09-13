import * as api from "./base";

export async function toggleRedirectionHost(id, enabled) {
	return await api.post({
		url: `/nginx/redirection-hosts/${id}/${enabled ? "enable" : "disable"}`,
	});
}
