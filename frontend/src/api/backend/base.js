import { QueryClient } from "@tanstack/react-query";
import queryString from "query-string";
import AuthStore from "src/modules/AuthStore";
import { camelizeKeys, decamelizeKeys } from "./caseConvert";

export const queryClient = new QueryClient();
const contentTypeHeader = "Content-Type";

function buildUrl({ url, params }) {
	const endpoint = url.replace(/^\/|\/$/g, "");
	const baseUrl = `/api/${endpoint}`;
	const apiUrl = queryString.stringifyUrl({
		url: baseUrl,
		query: decamelizeKeys(params),
	});
	return apiUrl;
}

function buildBody(data) {
	if (data) {
		return JSON.stringify(decamelizeKeys(data));
	}
}

async function processResponse(response, reload = true) {
	const payload = await response.json();
	if (!response.ok) {
		if (response.status === 401) {
			// Force logout user and reload the page if Unauthorized
			AuthStore.clear();
			queryClient.clear();
			if (reload) {
				window.location.reload();
			}
		}
		const error = new Error(payload.error?.message_i18n ?? payload.error?.message ?? `HTTP ${response.status}`);
		error.payload = payload;
		throw error;
	}
	return camelizeKeys(payload);
}

export async function get({ url, params, reload }, abortController) {
	const apiUrl = buildUrl({ url, params });
	const method = "GET";
	const signal = abortController?.signal;
	const response = await fetch(apiUrl, { method, signal });
	return processResponse(response, reload);
}

export async function download({ url, params }, filename = "download.file") {
	const res = await fetch(buildUrl({ url, params }));
	if (!res.ok) await processResponse(res);
	const bl = await res.blob();
	const u = window.URL.createObjectURL(bl);
	const a = document.createElement("a");
	a.href = u;
	a.download = filename;
	a.click();
	window.URL.revokeObjectURL(u);
}

export async function post({ url, params, data }, abortController) {
	const apiUrl = buildUrl({ url, params });
	const method = "POST";

	let headers = {};

	let body;
	// Check if the data is an instance of FormData
	// If data is FormData, let the browser set the Content-Type header
	if (data instanceof FormData) {
		body = data;
	} else {
		// If data is JSON, set the Content-Type header to 'application/json'
		headers = {
			[contentTypeHeader]: "application/json",
		};
		body = buildBody(data);
	}

	const signal = abortController?.signal;
	const response = await fetch(apiUrl, { method, headers, body, signal });
	return processResponse(response);
}

export async function put({ url, params, data }, abortController) {
	const apiUrl = buildUrl({ url, params });
	const method = "PUT";
	const headers = {
		[contentTypeHeader]: "application/json",
	};
	const signal = abortController?.signal;
	const body = buildBody(data);
	const response = await fetch(apiUrl, { method, headers, body, signal });
	return processResponse(response);
}

export async function del({ url, params }, abortController) {
	const apiUrl = buildUrl({ url, params });
	const method = "DELETE";
	const signal = abortController?.signal;
	const response = await fetch(apiUrl, { method, signal });
	return processResponse(response);
}
