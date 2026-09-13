import * as api from "./base";

export async function refreshToken(reload = true) {
	return await api.get({
		url: "/tokens",
		reload,
	});
}
