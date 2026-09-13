import * as api from "./base";

export async function renewCertificate(id) {
	return await api.post({
		url: `/nginx/certificates/${id}/renew`,
	});
}
