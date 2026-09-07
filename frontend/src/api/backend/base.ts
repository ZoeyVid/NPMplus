import { QueryClient } from "@tanstack/react-query";
import queryString, { type StringifiableRecord } from "query-string";
import AuthStore from "src/modules/AuthStore";
import { camelizeKeys, decamelize, decamelizeKeys } from "./caseConvert";
import { deleteToken } from "./deleteToken";

const queryClient = new QueryClient();
const contentTypeHeader = "Content-Type";
type AbortSource = AbortController | AbortSignal;

const getAbortSignal = (source?: AbortSource) => (source && "signal" in source ? source.signal : source);

interface BuildUrlArgs {
	url: string;
	params?: StringifiableRecord;
}

function decamelizeParams(params?: StringifiableRecord): StringifiableRecord | undefined {
	if (!params) {
		return undefined;
	}
	const result: StringifiableRecord = {};
	for (const [key, value] of Object.entries(params)) {
		result[decamelize(key)] = value;
	}

	return result;
}

function buildUrl({ url, params }: BuildUrlArgs) {
	const endpoint = url.replace(/^\/|\/$/g, "");
	const baseUrl = `/api/${endpoint}`;
	const apiUrl = queryString.stringifyUrl({
		url: baseUrl,
		query: decamelizeParams(params),
	});
	return apiUrl;
}

function buildBody(data?: Record<string, any>): string | undefined {
	if (data) {
		return JSON.stringify(decamelizeKeys(data));
	}
}

export interface ApiError extends Error {
	payload?: unknown;
}

async function processResponse<T = any>(response: Response, reload = true): Promise<T> {
	const payload = await response.json();
	if (!response.ok) {
		if (response.status === 401 && reload) {
			// Invalid or expired session: log out. Refresh attempts (reload=false)
			// only throw, so a logged-out visitor does not fire token deletes or
			// burn requests from the login rate limit on every render.
			// 403 is an expected answer for restricted users, not a logout.
			AuthStore.clear();
			queryClient.clear();
			await deleteToken().catch(() => {});
			window.location.reload();
		}
		const error = new Error(
			typeof payload.error.messageI18n !== "undefined" ? payload.error.messageI18n : payload.error.message,
		) as ApiError;
		error.payload = payload;
		throw error;
	}
	return camelizeKeys(payload) as T;
}

interface GetArgs {
	url: string;
	reload?: boolean;
	params?: queryString.StringifiableRecord;
}

async function baseGet({ url, params }: GetArgs, abortSource?: AbortSource) {
	const apiUrl = buildUrl({ url, params });
	const method = "GET";
	const signal = getAbortSignal(abortSource);
	const response = await fetch(apiUrl, { method, signal });
	return response;
}

export async function get<T = any>(args: GetArgs, abortSource?: AbortSource) {
	return processResponse<T>(await baseGet(args, abortSource), args.reload);
}

export async function download({ url, params }: GetArgs, filename = "download.file") {
	const res = await fetch(buildUrl({ url, params }));
	const bl = await res.blob();
	const u = window.URL.createObjectURL(bl);
	const a = document.createElement("a");
	a.href = u;
	a.download = filename;
	a.click();
	window.URL.revokeObjectURL(u);
}

interface PostArgs {
	url: string;
	params?: queryString.StringifiableRecord;
	data?: any;
	headers?: Record<string, string>;
}

export async function post<T = any>({ url, params, data, headers: extraHeaders }: PostArgs, abortSource?: AbortSource) {
	const apiUrl = buildUrl({ url, params });
	const method = "POST";

	let headers: Record<string, string> = { ...extraHeaders };

	let body: string | FormData | undefined;
	// Check if the data is an instance of FormData
	// If data is FormData, let the browser set the Content-Type header
	if (data instanceof FormData) {
		body = data;
	} else {
		// If data is JSON, set the Content-Type header to 'application/json'
		headers = {
			...extraHeaders,
			[contentTypeHeader]: "application/json",
		};
		body = buildBody(data);
	}

	const signal = getAbortSignal(abortSource);
	const response = await fetch(apiUrl, { method, headers, body, signal });
	return processResponse(response);
}

interface PutArgs {
	url: string;
	params?: queryString.StringifiableRecord;
	data?: Record<string, any>;
}
export async function put<T = any>({ url, params, data }: PutArgs, abortSource?: AbortSource) {
	const apiUrl = buildUrl({ url, params });
	const method = "PUT";
	const headers = {
		[contentTypeHeader]: "application/json",
	};
	const signal = getAbortSignal(abortSource);
	const body = buildBody(data);
	const response = await fetch(apiUrl, { method, headers, body, signal });
	return processResponse(response);
}

interface DeleteArgs {
	url: string;
	params?: queryString.StringifiableRecord;
}
export async function del<T = any>({ url, params }: DeleteArgs, abortSource?: AbortSource) {
	const apiUrl = buildUrl({ url, params });
	const method = "DELETE";
	const signal = getAbortSignal(abortSource);
	const response = await fetch(apiUrl, { method, signal });
	return processResponse(response);
}
