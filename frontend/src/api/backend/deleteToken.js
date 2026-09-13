import * as api from "./base";

export async function deleteToken() {
	return await api.del({
		url: "/tokens",
	});
}
