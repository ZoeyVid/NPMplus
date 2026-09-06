import * as api from "./base";

export interface CrowdsecDecision {
	id: number;
	uuid: string;
	scope: string;
	value: string;
	type: string;
	origin: string;
	scenario: string;
	duration: string;
	createdAt: string;
	until: string;
	simulated: boolean;
}

export interface CrowdsecDecisionPage {
	items: CrowdsecDecision[];
	limit: number;
	truncated: boolean;
	page: number;
	pageSize: number;
	hasNext: boolean;
	matched: number;
}

export interface CrowdsecDecisionParams {
	page?: number;
	pageSize?: number;
	search?: string;
	origin?: "local" | "community" | "all";
}

export interface CrowdsecEventMeta {
	key: string;
	value: string;
}

export interface CrowdsecEvent {
	timestamp: string;
	meta: CrowdsecEventMeta[];
}

export interface CrowdsecAlert {
	id: number;
	message: string;
	scenario: string;
	startAt: string;
	stopAt: string;
	createdAt: string;
	machineId: string;
	simulated: boolean;
	eventsCount: number;
	source: {
		ip: string;
		scope: string;
		value: string;
		country: string;
		asNumber: string;
		asName: string;
		range: string;
		rdns: string;
		latitude: number | null;
		longitude: number | null;
	};
	events: CrowdsecEvent[];
}

export interface CrowdsecUnbanResult {
	nbDeleted: string;
	auditLogged: boolean;
}

export interface CrowdsecBanInput {
	value: string;
	duration: string;
	type: string;
	reason?: string;
}

export interface CrowdsecBanResult {
	created: boolean;
	auditLogged: boolean;
}

export interface CrowdsecInsightsItem {
	name: string;
	count: number;
}

export interface CrowdsecInsights {
	windowHours: number;
	alertCount: number;
	activeDecisions: number | null;
	localActiveDecisions: number | null;
	sampled: boolean;
	activity: { start: string; count: number }[];
	locations: { latitude: number; longitude: number; country: string; count: number }[];
	signals: { id: string; severity: "info" | "warning"; type: "active-bans" | "attack-spike"; count?: number }[];
	topScenarios: CrowdsecInsightsItem[];
	topCountries: CrowdsecInsightsItem[];
	topAsns: CrowdsecInsightsItem[];
	topIps: CrowdsecInsightsItem[];
	topTargets: CrowdsecInsightsItem[];
}

export interface CrowdsecHistoryParams {
	page: number;
	pageSize: number;
	windowHours: number;
	search?: string;
	scenario?: string;
	country?: string;
	target?: string;
}

export interface CrowdsecAlertPage {
	items: CrowdsecAlert[];
	page: number;
	pageSize: number;
	hasNext: boolean;
	matched: number;
	windowHours: number;
	truncated: boolean;
}

export interface CrowdsecMetrics {
	available: boolean;
	error?: string;
	appsecConfigured?: boolean | null;
	appsecFailureAction?: "deny" | "passthrough" | null;
	appsecDropUnreadableBody?: boolean | null;
	appsecMetricsPresent?: boolean;
	activeDecisions?: number;
	localActiveDecisions?: number | null;
	communityActiveDecisions?: number | null;
	decisionOrigins?: { name: string; count: number }[];
	alerts?: number;
	appsecRequests?: number;
	appsecBlocked?: number;
	appsecPassed?: number;
	appsecBlockRate?: number | null;
	bouncerRequests?: number;
	bouncerDecisionHits?: number;
	machineRequests?: number;
	parserHits?: number;
	parserSuccessRate?: number | null;
	whitelistHits?: number;
	averageLapiMs?: number | null;
	averageParsingMs?: number | null;
}

export async function createCrowdsecBan(data: CrowdsecBanInput): Promise<CrowdsecBanResult> {
	return await api.post({ url: "/crowdsec/decisions", data });
}

export async function getCrowdsecInsights(windowHours = 24, signal?: AbortSignal): Promise<CrowdsecInsights> {
	return await api.get({ url: "/crowdsec/insights", params: { windowHours } }, signal);
}

export async function getCrowdsecAlertHistory(
	params: CrowdsecHistoryParams,
	signal?: AbortSignal,
): Promise<CrowdsecAlertPage> {
	return await api.get({ url: "/crowdsec/history/alerts", params: { ...params } }, signal);
}

export async function getCrowdsecMetrics(signal?: AbortSignal): Promise<CrowdsecMetrics> {
	return await api.get({ url: "/crowdsec/metrics" }, signal);
}

export async function getCrowdsecDecisions(
	params: CrowdsecDecisionParams = {},
	signal?: AbortSignal,
): Promise<CrowdsecDecisionPage> {
	return await api.get(
		{
			url: "/crowdsec/decisions",
			params: { page: params.page, pageSize: params.pageSize, search: params.search, origin: params.origin },
		},
		signal,
	);
}

export async function getCrowdsecAlerts(scope: string, value: string, signal?: AbortSignal): Promise<CrowdsecAlert[]> {
	return await api.get({ url: "/crowdsec/alerts", params: { scope, value } }, signal);
}

export async function unbanCrowdsecDecision(id: number): Promise<CrowdsecUnbanResult> {
	return await api.post({ url: "/crowdsec/decisions/delete", data: { id } });
}
