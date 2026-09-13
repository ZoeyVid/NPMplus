import * as api from "./base";

export async function toggleDeadHost(id, enabled) {
	return await api.post({
		url: `/nginx/dead-hosts/${id}/${enabled ? "enable" : "disable"}`,
	});
}
