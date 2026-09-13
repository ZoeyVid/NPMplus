import * as api from "./base";

export async function startTotpSetup(userId) {
	return await api.post({
		url: `/users/${userId}/mfa/totp`,
	});
}

export async function enableTotp(userId, code) {
	return await api.post({
		url: `/users/${userId}/mfa/totp/enable`,
		data: { code },
	});
}

export async function disableTotp(userId, code) {
	return await api.del({
		url: `/users/${userId}/mfa/totp`,
		params: {
			code,
		},
	});
}
