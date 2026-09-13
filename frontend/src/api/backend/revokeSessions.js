import * as api from "./base";

export async function revokeSessions(userId) {
	return await api.del({
		url: `/users/${userId}/sessions`,
	});
}
