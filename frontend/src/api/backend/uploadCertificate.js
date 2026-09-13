import * as api from "./base";

export async function uploadCertificate(id, data) {
	return await api.post({
		url: `/nginx/certificates/${id}/upload`,
		data,
	});
}
