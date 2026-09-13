import * as api from "./base";

export async function createDeadHost(item) {
	return await api.post({
		url: "/nginx/dead-hosts",
		data: item,
	});
}
