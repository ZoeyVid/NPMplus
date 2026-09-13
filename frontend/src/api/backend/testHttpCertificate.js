import * as api from "./base";

export async function testHttpCertificate(domains) {
	return await api.post({
		url: "/nginx/certificates/test-http",
		data: {
			domains,
		},
	});
}
