import * as api from "./base";

export async function getStreams(expand, params = {}) {
	return await api.get({
		url: "/nginx/streams",
		params: {
			expand: expand?.join(","),
			...params,
		},
	});
}
