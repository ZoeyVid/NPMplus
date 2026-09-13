import * as api from "./base";

export async function toggleStream(id, enabled) {
	return await api.post({
		url: `/nginx/streams/${id}/${enabled ? "enable" : "disable"}`,
	});
}
