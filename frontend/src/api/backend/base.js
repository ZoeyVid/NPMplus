import { QueryClient } from "@tanstack/react-query";
import queryString from "query-string";
import AuthStore from "src/modules/AuthStore";
import { camelizeKeys, decamelize, decamelizeKeys } from "./caseConvert";

export const queryClient = new QueryClient();
const contentTypeHeader = "Content-Type";

function decamelizeParams(params) {
	if (!params) {
		return;
	}
	const result = {};
	for (const [key, value] of Object.entries(params)) {
		result[decamelize(key)] = value;
	}

	return result;
}

function buildUrl({ url, params }) {
	const endpoint = url.replace(/^\/|\/$/g, "");
	const baseUrl = `/api/${endpoint}`;
	const apiUrl = queryString.stringifyUrl({
		url: baseUrl,
		query: decamelizeParams(params),
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

async function baseGet({ url, params }, abortController) {
	const apiUrl = buildUrl({ url, params });
	const method = "GET";
	const signal = abortController?.signal;
	const response = await fetch(apiUrl, { method, signal });
	return response;
}

export async function get(args, abortController) {
	return processResponse(await baseGet(args, abortController), args.reload);
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
