import * as api from "./base";

export async function startTotpSetup(userId) {
	return await api.post({
		url: `/users/${userId}/mfa/totp`,
	});
}

export async function enableTotp(userId, data) {
	return await api.post({
		url: `/users/${userId}/mfa/totp/enable`,
		data,
	});
}

export async function disableTotp(userId, data) {
	return await api.post({
		url: `/users/${userId}/mfa/totp/disable`,
		data,
	});
}
