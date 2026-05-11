import * as api from "./base";
import type { DnsCredential } from "./models";

export async function getDnsCredentials(params = {}): Promise<DnsCredential[]> {
	return await api.get({
		url: "/nginx/dns-credentials",
		params,
	});
}
