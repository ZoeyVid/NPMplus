import * as api from "./base";
import type { User } from "./models";

export async function uploadAvatar(id: number | string, file: File): Promise<User> {
	const data = new FormData();
	data.append("avatar", file);
	return await api.post({ url: `/users/${id}/avatar`, data });
}

export async function deleteAvatar(id: number | string): Promise<User> {
	return await api.del({ url: `/users/${id}/avatar` });
}
