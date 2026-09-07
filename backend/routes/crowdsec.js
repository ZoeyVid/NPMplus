import process from "node:process";
import express from "express";
import internalAuditLog from "../internal/audit-log.js";
import {
	fetchCrowdsec,
	lapiFetch,
	LAPI_USER_AGENT,
	lapiMachineFetch,
	publicError,
	readAppsecConfiguration,
	readCrowdsecJson,
	readRecentHoneypotIps,
} from "../internal/crowdsec.js";
import { fetchWithTimeout, readBoundedText } from "../lib/bounded-fetch.js";
import {
	crowdsecAlertTarget,
	filterCrowdsecAlerts,
	hasCrowdsecAdminAccess,
	normalizeCrowdsecAlerts,
	normalizeCrowdsecDecisions,
	parseCrowdsecDecisionId,
	parsePrometheusText,
	summarizeCrowdsecMetrics,
	validateManualBan,
} from "../lib/crowdsec-contract.js";
import jwtdecode from "../lib/express/jwt-decode.js";
import { debug, express as logger } from "../logger.js";

const router = express.Router({ caseSensitive: true, strict: true, mergeParams: true });

const LAPI_DECISION_LIMIT = 200;
const LAPI_PAGE_MAX_ITEMS = 500;
const LOCAL_DECISION_ORIGINS = ["crowdsec", "cscli", "cscli-import"];
const COMMUNITY_DECISION_ORIGINS = ["capi", "lists"];
const LAPI_ALERT_LIMIT = 5;
const LAPI_HONEYPOT_LIMIT = 25;
const INSIGHTS_WINDOW_HOURS = 24;
const INSIGHTS_ALERT_LIMIT = 100;
// the lapi always attaches every event+meta to each alert (there is no lean
// fields option), so an insights sample runs to megabytes on an attacked box:
// the primary sample gets an oversized-read allowance, and an exceptionally
// heavy window degrades to a smaller sample instead of failing the card
const INSIGHTS_FALLBACK_ALERT_LIMIT = 25;
const INSIGHTS_FALLBACK_MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
const INSIGHTS_TOP_N = 5;
const INSIGHTS_WINDOW_OPTIONS = new Set([1, 6, 24, 168]);
const HISTORY_PAGE_SIZE_DEFAULT = 25;
const HISTORY_PAGE_SIZE_MAX = 100;
const HISTORY_MAX_ITEMS = 500;
const HISTORY_WINDOW_HOURS_DEFAULT = 24;
const HISTORY_WINDOW_HOURS_MAX = 24 * 30;
const HISTORY_MAX_RESPONSE_BYTES = 12 * 1024 * 1024;
const METRICS_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const METRICS_TIMEOUT_MS = 3000;
const MANUAL_BAN_SCENARIO = "manual/web-ui";
const SCOPE_PATTERN = /^[a-zA-Z]{1,32}$/;
const metricsUrlFromLapi = () => {
	try {
		const url = new URL(process.env.CROWDSEC_LAPI_URL || "http://127.0.0.1:8080");
		url.port = process.env.CROWDSEC_METRICS_PORT || "6060";
		url.pathname = "/metrics";
		url.search = "";
		return url.toString();
	} catch {
		return "";
	}
};
const configuredMetricsUrl = process.env.CROWDSEC_METRICS_URL || metricsUrlFromLapi();
const CROWDSEC_METRICS_URL = (() => {
	try {
		const url = new URL(configuredMetricsUrl);
		return ["http:", "https:"].includes(url.protocol) ? url : null;
	} catch {
		return null;
	}
})();
const ANUBIS_UPSTREAM = process.env.AUTH_REQUEST_ANUBIS_UPSTREAM || "";
const ANUBIS_TIMEOUT_MS = 3000;
const ANUBIS_MAX_RESPONSE_BYTES = 64 * 1024;
const HONEYPOT_SCENARIO = "anubis-honeypot";

const requireAdmin = async (res) => {
	const permission = await res.locals.access.can("admin:access").catch(() => null);
	return hasCrowdsecAdminAccess(permission);
};

const queryString = (value, maxLength = 256) =>
	typeof value === "string" && value.length <= maxLength ? value.trim() : "";

const queryInteger = (value, fallback, minimum, maximum) => {
	const parsed = typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
	return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
};

const topCounts = (counts, limit = INSIGHTS_TOP_N) =>
	Object.entries(counts)
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.slice(0, limit)
		.map(([name, count]) => ({ name, count }));

const readAlertsSample = async (windowHours, limit) => {
	const params = new URLSearchParams({
		since: `${windowHours}h`,
		limit: String(limit),
		with_decisions: "false",
	});
	try {
		return await lapiMachineFetch(`/v1/alerts?${params}`, "GET", true, {
			readJson: (response) => readCrowdsecJson(response, HISTORY_MAX_RESPONSE_BYTES),
		});
	} catch (err) {
		if (err?.message !== "crowdsec.invalid-response" || limit <= INSIGHTS_FALLBACK_ALERT_LIMIT) throw err;
		params.set("limit", String(INSIGHTS_FALLBACK_ALERT_LIMIT));
		return lapiMachineFetch(`/v1/alerts?${params}`, "GET", true, {
			readJson: (response) => readCrowdsecJson(response, INSIGHTS_FALLBACK_MAX_RESPONSE_BYTES),
		});
	}
};

const alertTime = (alert) => alert.created_at || alert.start_at || alert.stop_at;

const activityBuckets = (alerts, windowHours) => {
	const bucketHours = windowHours <= 24 ? 1 : 24;
	const bucketCount = Math.ceil(windowHours / bucketHours);
	const end = new Date();
	end.setMinutes(0, 0, 0);
	if (bucketHours === 24) end.setHours(0);
	const startMs = end.getTime() - (bucketCount - 1) * bucketHours * 60 * 60 * 1000;
	const buckets = Array.from({ length: bucketCount }, (_, index) => ({
		start: new Date(startMs + index * bucketHours * 60 * 60 * 1000).toISOString(),
		count: 0,
	}));
	for (const alert of alerts) {
		const timestamp = Date.parse(alertTime(alert));
		if (!Number.isFinite(timestamp)) continue;
		const index = Math.floor((timestamp - startMs) / (bucketHours * 60 * 60 * 1000));
		if (index >= 0 && index < buckets.length) buckets[index].count += 1;
	}
	return buckets;
};

const attackSpike = (buckets) => {
	if (buckets.length < 2) return false;
	const latest = buckets.at(-1).count;
	const baseline = buckets.slice(0, -1).reduce((sum, bucket) => sum + bucket.count, 0) / (buckets.length - 1);
	return latest >= 5 && latest >= Math.max(2, baseline * 2);
};

router
	.route("/anubis")
	.options((_, res) => res.sendStatus(204))
	.all(jwtdecode())
	.get(async (req, res) => {
		if (!(await requireAdmin(res))) {
			res.status(403).send({ error: { message: "access.denied" } });
			return;
		}

		const response = {
			configured: Boolean(ANUBIS_UPSTREAM),
			honeypot: {
				status: ANUBIS_UPSTREAM ? "waiting" : "disabled",
				decisionsAvailable: true,
				activeCount: null,
				truncated: false,
				items: [],
			},
			container: { up: null, error: null },
			recent: [],
		};

		// 1. active honeypot bans straight from the LAPI, filtered by scenario.
		//    run in parallel with the other probes; a LAPI outage must not hide
		//    the container state and vice versa.
		const probes = [];
		probes.push(
			lapiFetch(`/v1/decisions?scenarios_containing=${HONEYPOT_SCENARIO}&limit=${LAPI_HONEYPOT_LIMIT + 1}`)
				.then((payload) => {
					const decisions = normalizeCrowdsecDecisions(payload);
					response.honeypot = {
						...response.honeypot,
						activeCount: decisions.length,
						truncated: decisions.length > LAPI_HONEYPOT_LIMIT,
						items: decisions.slice(0, LAPI_HONEYPOT_LIMIT),
					};
				})
				.catch((err) => {
					debug(logger, `Anubis honeypot decisions unavailable: ${err.message}`);
					response.honeypot.decisionsAvailable = false;
				}),
		);

		// 2. container health (only when wired up). anubis' /healthz lives on
		//    its separate metrics listener (:9090 by default) which this
		//    stack does not publish, so probing the auth_request upstream
		//    (the main :8923 listener) must treat ANY http response - even
		//    a 401/403 policy rejection or a redirect - as "the container is
		//    serving". only a network error/timeout means it is actually
		//    down, so follow no redirects and never throw on them.
		if (ANUBIS_UPSTREAM) {
			probes.push(
				fetchCrowdsec(
					ANUBIS_UPSTREAM,
					{
						method: "GET",
						redirect: "manual",
						// This is an internal reachability probe, not a visitor request.
						// Anubis requires a client address before evaluating its policy.
						headers: { "X-Real-Ip": "127.0.0.1" },
					},
					ANUBIS_TIMEOUT_MS,
				)
					.then(async (upstreamResponse) => {
						// discard the body but keep it bounded: it is a challenge page
						await readBoundedText(upstreamResponse, ANUBIS_MAX_RESPONSE_BYTES);
						response.container.up = true;
					})
					.catch((err) => {
						debug(logger, `Anubis upstream probe failed: ${err.message}`);
						response.container.up = false;
						response.container.error = "crowdsec.anubis-unreachable";
					}),
			);
		}

		// 3. recent honeypot catches from the log anubis writes on the shared
		//    data volume. the backend never writes it, it only reads.
		probes.push(
			readRecentHoneypotIps().then(({ status, items }) => {
				if (response.configured) response.honeypot.status = status;
				// newest-last from the log writer; the view wants newest-first
				response.recent = items.slice(-20).reverse();
			}),
		);

		// Every probe degrades independently so a CrowdSec outage cannot hide
		// Anubis reachability or honeypot-log readiness (and vice versa).
		await Promise.all(probes);
		res.status(200).send(response);
	});

router
	.route("/decisions")
	.options((_, res) => res.sendStatus(204))
	.all(jwtdecode())
	.get(async (req, res) => {
		if (!(await requireAdmin(res))) {
			res.status(403).send({ error: { message: "access.denied" } });
			return;
		}

		const paginated = typeof req.query.page === "string" || typeof req.query.page_size === "string";
		const page = queryInteger(req.query.page, 1, 1, 1000);
		const pageSize = queryInteger(req.query.page_size, 25, 1, 100);
		const search = queryString(req.query.search).toLocaleLowerCase();
		const requestedOrigin = queryString(req.query.origin, 32).toLocaleLowerCase();
		const origin = ["all", "local", "community"].includes(requestedOrigin) ? requestedOrigin : "local";
		const requestedEnd = page * pageSize;
		if (paginated && requestedEnd > LAPI_PAGE_MAX_ITEMS) {
			res.status(400).send({ error: { message: "crowdsec.page-too-deep" } });
			return;
		}
		let fetchLimit = LAPI_DECISION_LIMIT + 1;
		if (paginated) fetchLimit = search ? LAPI_PAGE_MAX_ITEMS + 1 : requestedEnd + 1;
		const decisionQuery = new URLSearchParams({ limit: String(fetchLimit) });
		if (origin === "local") decisionQuery.set("origins", LOCAL_DECISION_ORIGINS.join(","));
		if (origin === "community") decisionQuery.set("origins", COMMUNITY_DECISION_ORIGINS.join(","));
		const payload = await lapiFetch(`/v1/decisions?${decisionQuery}`);
		let decisions;
		try {
			decisions = normalizeCrowdsecDecisions(payload);
		} catch (err) {
			debug(logger, `CrowdSec decisions contract mismatch: ${err}`);
			throw publicError("crowdsec.invalid-response", 502);
		}
		if (!paginated) {
			res.status(200).send({
				items: decisions.slice(0, LAPI_DECISION_LIMIT),
				limit: LAPI_DECISION_LIMIT,
				truncated: decisions.length > LAPI_DECISION_LIMIT,
				page: 1,
				page_size: LAPI_DECISION_LIMIT,
				has_next: decisions.length > LAPI_DECISION_LIMIT,
				matched: Math.min(decisions.length, LAPI_DECISION_LIMIT),
			});
			return;
		}

		const filtered = decisions.filter((decision) => {
			if (origin === "local" && !LOCAL_DECISION_ORIGINS.includes(decision.origin.toLocaleLowerCase()))
				return false;
			if (origin === "community" && !COMMUNITY_DECISION_ORIGINS.includes(decision.origin.toLocaleLowerCase()))
				return false;
			if (!search) return true;
			return [decision.value, decision.scope, decision.scenario, decision.origin, decision.type].some(
				(value) => value.toLocaleLowerCase().includes(search),
			);
		});
		const start = (page - 1) * pageSize;
		const hasNext = filtered.length > requestedEnd;
		res.status(200).send({
			items: filtered.slice(start, requestedEnd),
			limit: LAPI_PAGE_MAX_ITEMS,
			truncated: decisions.length >= fetchLimit,
			page,
			page_size: pageSize,
			has_next: hasNext,
			matched: Math.min(filtered.length, requestedEnd),
		});
	});

router
	.route("/decisions/delete")
	.options((_, res) => res.sendStatus(204))
	.all(jwtdecode())
	.post(async (req, res) => {
		if (!(await requireAdmin(res))) {
			res.status(403).send({ error: { message: "access.denied" } });
			return;
		}

		const id = parseCrowdsecDecisionId(req.body?.id);
		if (!id) {
			res.status(400).send({ error: { message: "crowdsec.invalid-target" } });
			return;
		}

		// Record the operator's intent before changing CrowdSec. If this insert
		// fails, the external delete is not attempted.
		const auditEntry = await internalAuditLog.add(res.locals.access, {
			action: "delete-requested",
			object_type: "crowdsec-decision",
			object_id: id,
			meta: { decisionId: id, status: "requested" },
		});

		let result;
		try {
			result = await lapiMachineFetch(`/v1/decisions/${id}`, "DELETE");
		} catch (err) {
			try {
				await auditEntry.$query().patch({
					action: "delete-failed",
					meta: {
						decisionId: id,
						status: "failed",
						error: err.public ? err.message : "crowdsec.lapi-error",
					},
				});
			} catch (auditErr) {
				logger.warn(`Could not finalize failed CrowdSec audit entry ${auditEntry.id}: ${auditErr}`);
			}
			throw err;
		}

		const nbDeleted = String(result?.nbDeleted ?? "0");
		let auditLogged = true;
		try {
			await auditEntry.$query().patch({
				action: "deleted",
				meta: { decisionId: id, status: "deleted", nbDeleted },
			});
		} catch (auditErr) {
			auditLogged = false;
			logger.warn(`Could not finalize successful CrowdSec audit entry ${auditEntry.id}: ${auditErr}`);
		}

		res.status(200).send({ nbDeleted, audit_logged: auditLogged });
	});

router
	.route("/alerts")
	.options((_, res) => res.sendStatus(204))
	.all(jwtdecode())
	.get(async (req, res) => {
		if (!(await requireAdmin(res))) {
			res.status(403).send({ error: { message: "access.denied" } });
			return;
		}

		const { scope, value } = req.query;
		if (
			typeof scope !== "string" ||
			!SCOPE_PATTERN.test(scope) ||
			typeof value !== "string" ||
			value.length === 0 ||
			value.length > 512
		) {
			res.status(400).send({ error: { message: "crowdsec.invalid-target" } });
			return;
		}

		const query = new URLSearchParams({
			scope,
			value,
			limit: String(LAPI_ALERT_LIMIT),
			with_decisions: "false",
		});
		const payload = await lapiMachineFetch(`/v1/alerts?${query}`);
		let alerts;
		try {
			alerts = normalizeCrowdsecAlerts(payload);
		} catch (err) {
			debug(logger, `CrowdSec alerts contract mismatch: ${err}`);
			throw publicError("crowdsec.invalid-response", 502);
		}
		res.status(200).send(alerts);
	});

// Paginated alert history. CrowdSec's LAPI exposes a bounded newest-first
// list rather than an offset cursor, so each page requests only the prefix it
// needs and reports when the configured safety cap prevents deeper browsing.
router
	.route("/history/alerts")
	.options((_, res) => res.sendStatus(204))
	.all(jwtdecode())
	.get(async (req, res) => {
		if (!(await requireAdmin(res))) {
			res.status(403).send({ error: { message: "access.denied" } });
			return;
		}

		const page = queryInteger(req.query.page, 1, 1, 1000);
		const pageSize = queryInteger(req.query.page_size, HISTORY_PAGE_SIZE_DEFAULT, 1, HISTORY_PAGE_SIZE_MAX);
		const windowHours = queryInteger(
			req.query.window_hours,
			HISTORY_WINDOW_HOURS_DEFAULT,
			1,
			HISTORY_WINDOW_HOURS_MAX,
		);
		const requestedEnd = page * pageSize;
		if (requestedEnd > HISTORY_MAX_ITEMS) {
			res.status(400).send({ error: { message: "crowdsec.page-too-deep" } });
			return;
		}
		const filters = {
			search: queryString(req.query.search),
			scenario: queryString(req.query.scenario),
			country: queryString(req.query.country, 8),
			target: queryString(req.query.target),
		};
		const hasFilters = Object.values(filters).some(Boolean);
		const fetchLimit = hasFilters ? HISTORY_MAX_ITEMS + 1 : requestedEnd + 1;
		const payload = await readAlertsSample(windowHours, fetchLimit);
		let alerts;
		try {
			alerts = normalizeCrowdsecAlerts(payload).sort(
				(a, b) => Date.parse(alertTime(b)) - Date.parse(alertTime(a)) || b.id - a.id,
			);
		} catch (err) {
			debug(logger, `CrowdSec history contract mismatch: ${err}`);
			throw publicError("crowdsec.invalid-response", 502);
		}
		const filtered = filterCrowdsecAlerts(alerts, filters);
		const start = (page - 1) * pageSize;
		res.status(200).send({
			items: filtered.slice(start, requestedEnd),
			page,
			page_size: pageSize,
			has_next: filtered.length > requestedEnd,
			matched: Math.min(filtered.length, requestedEnd),
			window_hours: windowHours,
			truncated:
				alerts.length >= fetchLimit ||
				(fetchLimit > INSIGHTS_FALLBACK_ALERT_LIMIT && alerts.length === INSIGHTS_FALLBACK_ALERT_LIMIT),
		});
	});

// manual ban: the LAPI accepts an alert wrapper whose decision carries
// origin "cscli", so the ban appears like a cscli decisions add - the same
// pattern the crowdsec cli and other dashboards use
router
	.route("/decisions")
	.options((_, res) => res.sendStatus(204))
	.all(jwtdecode())
	.post(async (req, res) => {
		if (!(await requireAdmin(res))) {
			res.status(403).send({ error: { message: "access.denied" } });
			return;
		}

		const { value, duration, type, reason } = req.body ?? {};
		const errors = validateManualBan({ value, duration, type, reason });
		if (errors.length > 0) {
			res.status(400).send({ error: { message: "crowdsec.invalid-ban-input", fields: errors } });
			return;
		}

		// Record the operator's intent before changing CrowdSec.
		const auditEntry = await internalAuditLog.add(res.locals.access, {
			action: "create",
			object_type: "crowdsec-decision",
			object_id: 0,
			meta: { value, duration, type, reason, status: "requested", manual: true },
		});

		const now = new Date().toISOString();
		// ip scope for plain addresses, range scope for cidr targets
		const scope = value.includes("/") ? "range" : "ip";
		const payload = [
			{
				scenario: MANUAL_BAN_SCENARIO,
				message: reason ? `Manual ban from NPMplus: ${reason}` : "Manual ban from NPMplus",
				events_count: 1,
				start_at: now,
				stop_at: now,
				capacity: 0,
				leakspeed: "0",
				simulated: false,
				events: [],
				scenario_hash: "",
				scenario_version: "",
				source: { scope, value },
				decisions: [
					{
						type,
						duration,
						value,
						scope,
						origin: "cscli",
						scenario: MANUAL_BAN_SCENARIO,
					},
				],
			},
		];

		let result;
		try {
			result = await lapiMachineFetch("/v1/alerts", "POST", true, { body: payload });
		} catch (err) {
			try {
				await auditEntry.$query().patch({
					action: "create-failed",
					meta: { value, duration, type, reason, status: "failed", error: err.message },
				});
			} catch (auditErr) {
				logger.warn(`Could not finalize failed CrowdSec audit entry ${auditEntry.id}: ${auditErr}`);
			}
			throw err;
		}

		let auditLogged = true;
		try {
			await auditEntry.$query().patch({
				action: "created",
				object_id: 0,
				meta: { value, duration, type, reason, status: "created", manual: true },
			});
		} catch (auditErr) {
			auditLogged = false;
			logger.warn(`Could not finalize successful CrowdSec audit entry ${auditEntry.id}: ${auditErr}`);
		}

		res.status(200).send({ created: true, audit_logged: auditLogged, result });
	});

// Live analytics over a caller-selected, bounded window. This remains a
// read-only view over LAPI: no second database and no duplicate source of truth.
router
	.route("/insights")
	.options((_, res) => res.sendStatus(204))
	.all(jwtdecode())
	.get(async (req, res) => {
		if (!(await requireAdmin(res))) {
			res.status(403).send({ error: { message: "access.denied" } });
			return;
		}

		const requestedWindow = queryInteger(req.query.window_hours, INSIGHTS_WINDOW_HOURS, 1, 168);
		const windowHours = INSIGHTS_WINDOW_OPTIONS.has(requestedWindow) ? requestedWindow : INSIGHTS_WINDOW_HOURS;
		const localDecisionQuery = new URLSearchParams({
			limit: String(LAPI_DECISION_LIMIT + 1),
			origins: LOCAL_DECISION_ORIGINS.join(","),
		});
		const [payload, decisionPayload] = await Promise.all([
			readAlertsSample(windowHours, INSIGHTS_ALERT_LIMIT),
			lapiFetch(`/v1/decisions?${localDecisionQuery}`).catch((err) => {
				debug(logger, `CrowdSec active decision count unavailable: ${err.message}`);
				return null;
			}),
		]);
		const alerts = normalizeCrowdsecAlerts(payload);
		const countries = {};
		const asns = {};
		const ips = {};
		const scenarios = {};
		const targets = {};
		const locationCounts = new Map();
		for (const alert of alerts) {
			if (alert.scenario) scenarios[alert.scenario] = (scenarios[alert.scenario] ?? 0) + 1;
			const country = alert.source?.country;
			if (country) countries[country] = (countries[country] ?? 0) + 1;
			const asn = alert.source?.as_name || (alert.source?.as_number ? `AS${alert.source.as_number}` : "");
			if (asn) asns[asn] = (asns[asn] ?? 0) + 1;
			const ip = alert.source?.ip || alert.source?.value;
			if (ip) ips[ip] = (ips[ip] ?? 0) + 1;
			const target = crowdsecAlertTarget(alert);
			if (target) targets[target] = (targets[target] ?? 0) + 1;
			if (alert.source?.latitude !== null && alert.source?.longitude !== null) {
				const key = `${alert.source.latitude},${alert.source.longitude},${country}`;
				const location = locationCounts.get(key) ?? {
					latitude: alert.source.latitude,
					longitude: alert.source.longitude,
					country: country || "",
					count: 0,
				};
				location.count += 1;
				locationCounts.set(key, location);
			}
		}
		const activity = activityBuckets(alerts, windowHours);
		const decisions = decisionPayload === null ? null : normalizeCrowdsecDecisions(decisionPayload);
		// honeypot bans arrive as origin "cscli" but get their own dashboard card;
		// keep them out of the local active-bans figure so the two never double-count
		const localDecisions =
			decisions === null ? null : decisions.filter((decision) => decision.scenario !== HONEYPOT_SCENARIO);
		const activeDecisions =
			localDecisions === null ? null : Math.min(localDecisions.length, LAPI_DECISION_LIMIT);
		// a full sample means the buckets only cover the newest tail of the window,
		// so the spike baseline is structurally deflated - never call that a spike
		const sampled = alerts.length >= INSIGHTS_ALERT_LIMIT;
		const signals = [];
		if (!sampled && attackSpike(activity))
			signals.push({ id: `spike-${activity.at(-1).start}`, severity: "warning", type: "attack-spike" });
		if (activeDecisions > 0)
			signals.push({
				id: `bans-${activeDecisions}`,
				severity: "info",
				type: "active-bans",
				count: activeDecisions,
			});

		res.status(200).send({
			window_hours: windowHours,
			alert_count: alerts.length,
			active_decisions: activeDecisions,
			local_active_decisions: activeDecisions,
			sampled,
			activity,
			locations: [...locationCounts.values()].sort((a, b) => b.count - a.count).slice(0, 100),
			signals,
			top_scenarios: topCounts(scenarios),
			top_countries: topCounts(countries),
			top_asns: topCounts(asns),
			top_ips: topCounts(ips),
			top_targets: topCounts(targets),
		});
	});

router
	.route("/metrics")
	.options((_, res) => res.sendStatus(204))
	.all(jwtdecode())
	.get(async (_req, res) => {
		if (!(await requireAdmin(res))) {
			res.status(403).send({ error: { message: "access.denied" } });
			return;
		}
		const appsecConfiguration = await readAppsecConfiguration();
		if (!CROWDSEC_METRICS_URL) {
			res.status(200).send({
				available: false,
				error: "crowdsec.metrics-unconfigured",
				...appsecConfiguration,
			});
			return;
		}
		try {
			const response = await fetchWithTimeout(
				CROWDSEC_METRICS_URL,
				{
					headers: { "User-Agent": LAPI_USER_AGENT },
					redirect: "error",
				},
				METRICS_TIMEOUT_MS,
			);
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const text = await readBoundedText(response, METRICS_MAX_RESPONSE_BYTES);
			res.status(200).send({
				available: true,
				...appsecConfiguration,
				...summarizeCrowdsecMetrics(parsePrometheusText(text)),
			});
		} catch (err) {
			debug(logger, `CrowdSec metrics unavailable: ${err}`);
			res.status(200).send({
				available: false,
				error: "crowdsec.metrics-unavailable",
				...appsecConfiguration,
			});
		}
	});

export default router;