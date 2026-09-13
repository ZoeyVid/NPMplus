import * as api from "./base";

export async function createStream(item) {
	return await api.post({
		url: "/nginx/streams",
		data: item,
	});
}
