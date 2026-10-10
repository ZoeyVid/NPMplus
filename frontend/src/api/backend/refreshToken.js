import * as api from "./base";

export async function refreshToken(reload) {
	return await api.get({
		url: "/tokens",
		reload,
	});
}
