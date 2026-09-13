import * as api from "./base";

export async function downloadCertificate(id) {
	await api.download(
		{
			url: `/nginx/certificates/${id}/download`,
		},
		`certificate-${id}.zip`,
	);
}
