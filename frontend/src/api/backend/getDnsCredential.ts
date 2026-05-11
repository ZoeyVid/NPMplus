import * as api from "./base";
import type { DnsCredential } from "./models";

export async function getDnsCredential(id: number): Promise<DnsCredential> {
	return await api.get({
		url: `/nginx/dns-credentials/${id}`,
	});
}
