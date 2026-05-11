import * as api from "./base";
import type { DnsCredential } from "./models";

export async function updateDnsCredential(
	id: number,
	item: { provider_id?: string; credentials?: string; name?: string },
): Promise<DnsCredential> {
	return await api.put({
		url: `/nginx/dns-credentials/${id}`,
		data: item,
	});
}
