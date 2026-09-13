import * as api from "./base";

export async function getToken(identity, secret) {
	return await api.post({
		url: "/tokens",
		data: { identity, secret },
	});
}

export async function verifyTotp(code) {
	return await api.post({
		url: "/tokens/totp",
		data: { code },
	});
}
