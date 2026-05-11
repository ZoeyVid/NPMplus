import * as api from "./base";

export async function deleteDnsCredential(id: number): Promise<boolean> {
	return await api.del({
		url: `/nginx/dns-credentials/${id}`,
	});
}
