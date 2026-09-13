import * as api from "./base";

export async function getAuditLog(id, expand, params = {}) {
	return await api.get({
		url: `/audit-log/${id}`,
		params: {
			expand: expand?.join(","),
			...params,
		},
	});
}
