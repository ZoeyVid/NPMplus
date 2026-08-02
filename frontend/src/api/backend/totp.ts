import * as api from "./base";
import type { TotpEnableResponse, TotpSetupResponse } from "./responseTypes";

export async function startTotpSetup(userId: number | "me"): Promise<TotpSetupResponse> {
	return await api.post({
		url: `/users/${userId}/mfa/totp`,
	});
}

export async function enableTotp(userId: number | "me", code: string): Promise<TotpEnableResponse> {
	return await api.post({
		url: `/users/${userId}/mfa/totp/enable`,
		data: { code },
	});
}

export async function disableTotp(userId: number | "me", code: string): Promise<boolean> {
	return await api.del({
		url: `/users/${userId}/mfa/totp`,
		params: {
			code,
		},
	});
}
