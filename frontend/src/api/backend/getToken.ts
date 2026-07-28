import * as api from "./base";
import type { TokenResponse } from "./responseTypes";

export async function getToken(identity: string, secret: string): Promise<TokenResponse & { requires2fa?: boolean }> {
	return await api.post({
		url: "/tokens",
		data: { identity, secret },
	});
}

export async function verify2FA(code: string): Promise<TokenResponse> {
	return await api.post({
		url: "/tokens/2fa",
		data: { code },
	});
}
