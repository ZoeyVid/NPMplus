import * as api from "./base";

export async function createAccessList(item) {
	return await api.post({
		url: "/nginx/access-lists",
		data: item,
	});
}
