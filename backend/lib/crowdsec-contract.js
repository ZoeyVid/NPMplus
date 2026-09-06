const optionalString = (value) => (typeof value === "string" ? value : "");
const optionalFiniteNumber = (value) => {
	if (value === null || value === "" || typeof value === "undefined") return null;
	const number = typeof value === "number" ? value : Number(value);
	return Number.isFinite(number) ? number : null;
};

// manual ban input: an ip or a cidr range, the same targets crowdsec accepts
const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6_RE = /^\[?[0-9a-fA-F:]+\]?$/;
const CIDR_RE = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$|^(\[?[0-9a-fA-F:]+\]?\/\d{1,3})$/;
const DURATION_RE = /^[1-9][0-9]*(ns|us|µs|ms|s|m|h|d)$/;
const BAN_TYPES = new Set(["ban", "captcha"]);
const REASONS_RE = /^[\w .,:;#@-]{1,64}$/;
const PROMETHEUS_LINE_SPLIT_RE = /\r?\n/;
const PROMETHEUS_SAMPLE_RE = /^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{(.*)\})?\s+([^\s]+)(?:\s+\d+)?$/;
const LOCAL_DECISION_ORIGINS = new Set(["crowdsec", "cscli", "cscli-import"]);
const COMMUNITY_DECISION_ORIGINS = new Set(["capi", "lists"]);
const ALERT_FIELD_TOKEN_RE = /^(scenario|country|ip|target|asn|machine):(.*)$/;
const WHITESPACE_RE = /\s+/;
const QUOTE_RE = /^["']|["']$/g;

const parseCrowdsecDecisionId = (value) => {
	const id = typeof value === "number" ? value : Number(value);
	return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const validateManualBan = ({ value, duration, type = "ban", reason = "" }) => {
	const errors = [];
	if (typeof value !== "string" || !(IPV4_RE.test(value) || IPV6_RE.test(value) || CIDR_RE.test(value))) {
		errors.push("value");
	}
	if (typeof duration !== "string" || !DURATION_RE.test(duration)) {
		errors.push("duration");
	}
	if (typeof type !== "string" || !BAN_TYPES.has(type)) {
		errors.push("type");
	}
	if (reason && !REASONS_RE.test(reason)) {
		errors.push("reason");
	}
	return errors;
};

// per-event meta keys that are safe and useful to show an operator: they
// describe the attacker and the request, never payloads or secrets
const EVENT_META_KEYS = new Set([
	"source_ip",
	"source_rdns",
	"source_as_number",
	"source_as_name",
	"source_range",
	"source_country",
	"target_uri",
	"target_fqdn",
	"target_host",
	"method",
	"http_user_agent",
	"service",
	"log_type",
]);

const EVENT_LIMIT = 10;

const normalizeEvent = (event) => {
	if (!event || typeof event !== "object") return null;
	const meta = [];
	if (Array.isArray(event.meta)) {
		for (const item of event.meta) {
			if (!item || typeof item !== "object") continue;
			const key = typeof item.key === "string" ? item.key : "";
			const value = typeof item.value === "string" ? item.value : "";
			if (!EVENT_META_KEYS.has(key) || !value) continue;
			// hard cap each value: long user agents or uris must not bloat the page
			meta.push({ key, value: value.slice(0, 512) });
		}
	}
	const timestamp = typeof event.timestamp === "string" ? event.timestamp : "";
	return { timestamp, meta };
};

const normalizeCrowdsecDecisions = (payload) => {
	if (payload === null || typeof payload === "undefined") return [];
	if (!Array.isArray(payload)) throw new TypeError("CrowdSec decisions response is not an array");

	return payload.map((decision) => {
		if (!decision || typeof decision !== "object") {
			throw new TypeError("CrowdSec decision is not an object");
		}
		const id = parseCrowdsecDecisionId(decision.id);
		if (!id || typeof decision.value !== "string" || decision.value.length === 0) {
			throw new TypeError("CrowdSec decision is missing its id or value");
		}

		return {
			id,
			uuid: optionalString(decision.uuid),
			scope: optionalString(decision.scope) || "Ip",
			value: decision.value,
			type: optionalString(decision.type),
			origin: optionalString(decision.origin),
			scenario: optionalString(decision.scenario),
			duration: optionalString(decision.duration),
			created_at: optionalString(decision.created_at),
			until: optionalString(decision.until),
			simulated: decision.simulated === true,
		};
	});
};

const normalizeCrowdsecAlerts = (payload) => {
	if (payload === null || typeof payload === "undefined") return [];
	if (!Array.isArray(payload)) throw new TypeError("CrowdSec alerts response is not an array");

	return payload.map((alert) => {
		if (!alert || typeof alert !== "object") {
			throw new TypeError("CrowdSec alert is not an object");
		}
		const id = parseCrowdsecDecisionId(alert.id);
		if (!id) throw new TypeError("CrowdSec alert is missing its id");

		const eventsCount = Number(alert.events_count);
		const events = [];
		if (Array.isArray(alert.events)) {
			for (const event of alert.events.slice(0, EVENT_LIMIT)) {
				const normalized = normalizeEvent(event);
				if (normalized) events.push(normalized);
			}
		}
		return {
			id,
			scenario: optionalString(alert.scenario),
			message: optionalString(alert.message),
			start_at: optionalString(alert.start_at),
			stop_at: optionalString(alert.stop_at),
			created_at: optionalString(alert.created_at),
			machine_id: optionalString(alert.machine_id),
			simulated: alert.simulated === true,
			events_count: Number.isSafeInteger(eventsCount) && eventsCount >= 0 ? eventsCount : 0,
			// attacker identity as recorded by the local agent: geo/ASN only
			source: {
				ip: optionalString(alert.source?.ip),
				scope: optionalString(alert.source?.scope),
				value: optionalString(alert.source?.value),
				country: optionalString(alert.source?.cn),
				as_number: optionalString(alert.source?.as_number),
				as_name: optionalString(alert.source?.as_name),
				range: optionalString(alert.source?.range),
				rdns: optionalString(alert.source?.rdns),
				latitude: optionalFiniteNumber(alert.source?.latitude),
				longitude: optionalFiniteNumber(alert.source?.longitude),
			},
			events,
		};
	});
};

const crowdsecAlertTarget = (alert) => {
	for (const event of alert.events ?? []) {
		for (const item of event.meta ?? []) {
			if (["target_host", "target_fqdn", "target_uri"].includes(item.key) && item.value) return item.value;
		}
	}
	return "";
};

const filterCrowdsecAlerts = (alerts, { search = "", scenario = "", country = "", target = "" } = {}) => {
	const tokens = optionalString(search).trim().toLocaleLowerCase().split(WHITESPACE_RE).filter(Boolean);
	const fieldFilters = [];
	const words = [];
	for (const token of tokens) {
		const match = ALERT_FIELD_TOKEN_RE.exec(token);
		const needle = match?.[2]?.replace(QUOTE_RE, "");
		if (match && needle) fieldFilters.push({ field: match[1], needle });
		else words.push(token);
	}
	const scenarioNeedle = optionalString(scenario).trim().toLocaleLowerCase();
	const countryNeedle = optionalString(country).trim().toLocaleLowerCase();
	const targetNeedle = optionalString(target).trim().toLocaleLowerCase();

	return alerts.filter((alert) => {
		const alertTarget = crowdsecAlertTarget(alert);
		if (scenarioNeedle && alert.scenario.toLocaleLowerCase() !== scenarioNeedle) return false;
		if (countryNeedle && alert.source.country.toLocaleLowerCase() !== countryNeedle) return false;
		if (targetNeedle && !alertTarget.toLocaleLowerCase().includes(targetNeedle)) return false;
		const searchable = [
			String(alert.id),
			alert.scenario,
			alert.message,
			alert.source.ip,
			alert.source.value,
			alert.source.country,
			alert.source.as_name,
			alert.source.rdns,
			alert.machine_id,
			alertTarget,
		];
		for (const { field, needle } of fieldFilters) {
			const value = {
				scenario: alert.scenario,
				country: alert.source.country,
				ip: alert.source.ip || alert.source.value,
				target: alertTarget,
				asn: alert.source.as_name || alert.source.as_number,
				machine: alert.machine_id,
			}[field];
			if (!optionalString(value).toLocaleLowerCase().includes(needle)) return false;
		}
		return words.every((word) =>
			searchable.some((value) => optionalString(value).toLocaleLowerCase().includes(word)),
		);
	});
};

const parsePrometheusLabels = (raw = "") => {
	const labels = {};
	for (const match of raw.matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)="((?:\\.|[^"\\])*)"/g)) {
		labels[match[1]] = match[2].replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
	}
	return labels;
};

// Parse only the Prometheus text exposition primitives used by CrowdSec.
// Comments, malformed rows and non-finite values are ignored.
const parsePrometheusText = (text) => {
	const samples = [];
	for (const line of String(text).split(PROMETHEUS_LINE_SPLIT_RE)) {
		if (!line || line.startsWith("#")) continue;
		const match = PROMETHEUS_SAMPLE_RE.exec(line);
		if (!match) continue;
		const value = Number(match[3]);
		if (!Number.isFinite(value)) continue;
		samples.push({ name: match[1], labels: parsePrometheusLabels(match[2]), value });
	}
	return samples;
};

const summarizeCrowdsecMetrics = (samples) => {
	const sum = (name) =>
		samples.filter((sample) => sample.name === name).reduce((total, sample) => total + sample.value, 0);
	const ratio = (numerator, denominator) => (denominator > 0 ? numerator / denominator : null);
	const parserHits = sum("cs_parser_hits_total");
	const parserOk = sum("cs_parser_hits_ok_total");
	const lapiCount = sum("cs_lapi_request_duration_seconds_count");
	const parsingCount = sum("cs_parsing_time_seconds_count");
	const appsecRequests = sum("cs_appsec_reqs_total");
	const appsecBlocked = sum("cs_appsec_block_total");
	const activeDecisionSamples = samples.filter((sample) => sample.name === "cs_active_decisions");
	const hasDecisionOriginLabels = activeDecisionSamples.some((sample) => optionalString(sample.labels?.origin));
	const decisionOriginCounts = new Map();
	for (const sample of activeDecisionSamples) {
		const origin = optionalString(sample.labels?.origin).toLocaleLowerCase() || "unknown";
		decisionOriginCounts.set(origin, (decisionOriginCounts.get(origin) ?? 0) + sample.value);
	}
	const countOrigins = (origins) =>
		[...decisionOriginCounts.entries()]
			.filter(([origin]) => origins.has(origin))
			.reduce((total, [, value]) => total + value, 0);

	return {
		active_decisions: activeDecisionSamples.reduce((total, sample) => total + sample.value, 0),
		local_active_decisions: hasDecisionOriginLabels ? countOrigins(LOCAL_DECISION_ORIGINS) : null,
		community_active_decisions: hasDecisionOriginLabels ? countOrigins(COMMUNITY_DECISION_ORIGINS) : null,
		decision_origins: [...decisionOriginCounts.entries()]
			.map(([name, count]) => ({ name, count }))
			.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
		alerts: sum("cs_alerts"),
		appsec_metrics_present: samples.some((sample) => sample.name.startsWith("cs_appsec_")),
		appsec_requests: appsecRequests,
		appsec_blocked: appsecBlocked,
		appsec_passed: Math.max(0, appsecRequests - appsecBlocked),
		appsec_block_rate: ratio(appsecBlocked, appsecRequests),
		bouncer_requests: sum("cs_lapi_bouncer_requests_total"),
		// non-empty answers LAPI served to bouncers: the direct proof that
		// decisions are actually reaching the reverse proxy for enforcement
		bouncer_decision_hits: sum("cs_lapi_decisions_ok_total"),
		machine_requests: sum("cs_lapi_machine_requests_total"),
		parser_hits: parserHits,
		parser_success_rate: ratio(parserOk, parserHits),
		whitelist_hits: sum("cs_node_wl_hits_ok_total") || sum("cs_node_wl_hits_total"),
		average_lapi_ms: ratio(sum("cs_lapi_request_duration_seconds_sum") * 1000, lapiCount),
		average_parsing_ms: ratio(sum("cs_parsing_time_seconds_sum") * 1000, parsingCount),
	};
};

const hasCrowdsecAdminAccess = (permission) => Boolean(permission);

export {
	crowdsecAlertTarget,
	filterCrowdsecAlerts,
	hasCrowdsecAdminAccess,
	normalizeCrowdsecAlerts,
	normalizeCrowdsecDecisions,
	parseCrowdsecDecisionId,
	parsePrometheusText,
	summarizeCrowdsecMetrics,
	validateManualBan,
};
