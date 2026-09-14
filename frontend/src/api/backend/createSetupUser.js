import * as api from "./base";

export async function createSetupUser(item) {
	return await api.post({
		url: "/users/setup",
		data: item,
	});
}
