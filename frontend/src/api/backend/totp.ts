import * as api from "./base";
import type { TotpEnableResponse, TotpSetupResponse, TotpStatusResponse } from "./responseTypes";

export async function getTotpStatus(userId: number | "me"): Promise<TotpStatusResponse> {
	return await api.get({
		url: `/users/${userId}/totp`,
	});
}

export async function startTotpSetup(userId: number | "me"): Promise<TotpSetupResponse> {
	return await api.post({
		url: `/users/${userId}/totp`,
	});
}

export async function enableTotp(userId: number | "me", code: string): Promise<TotpEnableResponse> {
	return await api.post({
		url: `/users/${userId}/totp/enable`,
		data: { code },
	});
}

export async function disableTotp(userId: number | "me", code: string): Promise<boolean> {
	return await api.del({
		url: `/users/${userId}/totp`,
		params: {
			code,
		},
	});
}

export async function regenerateBackupCodes(userId: number | "me", code: string): Promise<TotpEnableResponse> {
	return await api.post({
		url: `/users/${userId}/totp/backup-codes`,
		data: { code },
	});
}

export async function adminDisableMfa(userId: number): Promise<boolean> {
	return await api.del({
		url: `/users/${userId}/totp`,
	});
}
