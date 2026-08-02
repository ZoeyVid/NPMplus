import * as api from "./base";
import type { MfaBackupCodesResponse, MfaStatusResponse } from "./responseTypes";

export async function getMfaStatus(userId: number | "me"): Promise<MfaStatusResponse> {
	return await api.get({
		url: `/users/${userId}/mfa`,
	});
}

export async function regenerateBackupCodes(userId: number | "me", code: string): Promise<MfaBackupCodesResponse> {
	return await api.post({
		url: `/users/${userId}/mfa/backup-codes`,
		data: { code },
	});
}

export async function adminDisableMfa(userId: number): Promise<boolean> {
	return await api.del({
		url: `/users/${userId}/mfa`,
	});
}
