import * as api from "./base";

export async function deleteRedirectionHost(id) {
	return await api.del({
		url: `/nginx/redirection-hosts/${id}`,
	});
}
