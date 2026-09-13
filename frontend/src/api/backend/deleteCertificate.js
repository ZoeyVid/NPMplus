import * as api from "./base";

export async function deleteCertificate(id) {
	return await api.del({
		url: `/nginx/certificates/${id}`,
	});
}
