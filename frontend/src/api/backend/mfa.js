import * as api from "./base";

export async function getMfaStatus(userId) {
	return await api.get({
		url: `/users/${userId}/mfa`,
	});
}

export async function regenerateBackupCodes(userId, data) {
	return await api.post({
		url: `/users/${userId}/mfa/backup-codes`,
		data,
	});
}

export async function adminDisableMfa(userId) {
	return await api.del({
		url: `/users/${userId}/mfa`,
	});
}
