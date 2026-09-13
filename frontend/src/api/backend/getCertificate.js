import * as api from "./base";

export async function getCertificate(id, expand, params = {}) {
	return await api.get({
		url: `/nginx/certificates/${id}`,
		params: {
			expand: expand?.join(","),
			...params,
		},
	});
}
