import * as api from "./base";

export async function downloadCertificate(id: number): Promise<void> {
	await api.downloadPost(
		{
			url: "/nginx/certificates/download",
			data: { id },
		},
		`certificate-${id}.zip`,
	);
}
