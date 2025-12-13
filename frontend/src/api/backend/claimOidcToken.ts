import * as api from "./base";
import type { TokenResponse } from "./responseTypes";

export async function claimOidcToken(): Promise<TokenResponse> {
	return await api.post({
		url: "/oidc/claim",
		noAuth: true,
	});
}
