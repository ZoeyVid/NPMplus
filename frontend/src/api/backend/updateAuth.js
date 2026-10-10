import * as api from "./base";

export async function updateAuth(userId, newPassword, current) {
	return await api.put({
		url: `/users/${userId}/auth`,
		data: {
			type: "password",
			current,
			secret: newPassword,
		},
	});
}
