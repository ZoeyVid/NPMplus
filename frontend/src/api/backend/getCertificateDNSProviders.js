import * as api from "./base";

export async function getCertificateDNSProviders(params = {}) {
	return await api.get({
		url: "/nginx/certificates/dns-providers",
		params,
	});
}
