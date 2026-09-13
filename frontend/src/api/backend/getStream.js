import * as api from "./base";

export async function getStream(id, expand, params = {}) {
	return await api.get({
		url: `/nginx/streams/${id}`,
		params: {
			expand: expand?.join(","),
			...params,
		},
	});
}
