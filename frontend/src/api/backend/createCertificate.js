import * as api from "./base";

export async function createCertificate(item) {
	return await api.post({
		url: "/nginx/certificates",
		data: item,
	});
}
