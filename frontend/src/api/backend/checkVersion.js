import * as api from "./base";

export async function checkVersion() {
	return await api.get({
		url: "/version/check",
	});
}
