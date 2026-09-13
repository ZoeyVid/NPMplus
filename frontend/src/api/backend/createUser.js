import * as api from "./base";

export async function createUser(item) {
	return await api.post({
		url: "/users",
		data: item,
	});
}
