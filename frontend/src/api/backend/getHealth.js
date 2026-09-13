import * as api from "./base";

export async function getHealth() {
	return await api.get({
		url: "/",
	});
}
