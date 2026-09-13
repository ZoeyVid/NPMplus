import * as api from "./base";

export async function validateCertificate(data) {
	return await api.post({
		url: "/nginx/certificates/validate",
		data,
	});
}
