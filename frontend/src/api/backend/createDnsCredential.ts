import * as api from "./base";
import type { DnsCredential } from "./models";

export async function createDnsCredential(item: {
	providerId: string;
	credentials: string;
	name: string;
}): Promise<DnsCredential> {
	return await api.post({
		url: "/nginx/dns-credentials",
		data: item,
	});
}
