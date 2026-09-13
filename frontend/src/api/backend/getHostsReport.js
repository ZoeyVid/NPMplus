import * as api from "./base";

export async function getHostsReport() {
	return await api.get({
		url: "/reports/hosts",
	});
}
