import * as api from "./base";

export async function revokeSessions(userId: number | "me"): Promise<boolean> {
	return await api.del({
		url: `/users/${userId}/sessions`,
	});
}
