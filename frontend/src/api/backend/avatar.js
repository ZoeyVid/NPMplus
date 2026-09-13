import * as api from "./base";

export async function uploadAvatar(id, file) {
	const data = new FormData();
	data.append("avatar", file);
	return await api.post({ url: `/users/${id}/avatar`, data });
}

export async function deleteAvatar(id) {
	return await api.del({ url: `/users/${id}/avatar` });
}
