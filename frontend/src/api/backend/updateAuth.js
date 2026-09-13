import * as api from "./base";

export async function updateAuth(userId, newPassword, current) {
	const data = {
		type: "password",
		current,
		secret: newPassword,
	};
	if (userId === "me") {
		data.current = current;
	}

	return await api.put({
		url: `/users/${userId}/auth`,
		data,
	});
}
