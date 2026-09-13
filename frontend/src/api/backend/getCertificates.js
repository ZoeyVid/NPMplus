import * as api from "./base";

export async function getCertificates(expand, params = {}) {
	return await api.get({
		url: "/nginx/certificates",
		params: {
			expand: expand?.join(","),
			...params,
		},
	});
}
