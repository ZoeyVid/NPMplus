import assert from "node:assert/strict";
import test from "node:test";
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

const notArrayPattern = /not an array/;
const missingIdPattern = /missing its id/;

test("CrowdSec decisions are reduced to the stable public contract", () => {
	const decisions = normalizeCrowdsecDecisions([
		{
			id: 42,
			uuid: "uuid-42",
			scope: "Ip",
			value: "192.0.2.42",
			type: "ban",
			origin: "crowdsec",
			scenario: "http-probing",
			duration: "3h59m",
			created_at: "2026-09-03T00:00:00Z",
			until: "2026-09-03T04:00:00Z",
			simulated: true,
		},
	]);

	assert.deepEqual(decisions, [
		{
			id: 42,
			uuid: "uuid-42",
			scope: "Ip",
			value: "192.0.2.42",
			type: "ban",
			origin: "crowdsec",
			scenario: "http-probing",
			duration: "3h59m",
			created_at: "2026-09-03T00:00:00Z",
			until: "2026-09-03T04:00:00Z",
			simulated: true,
		},
	]);
});

test("CrowdSec alerts keep attacker details while stripping sensitive payloads", () => {
	const alerts = normalizeCrowdsecAlerts([
		{
			id: 9,
			scenario: "http-bad-user-agent",
			message: "blocked",
			start_at: "2026-09-03T00:00:00Z",
			stop_at: "2026-09-03T00:01:00Z",
			created_at: "2026-09-03T00:01:01Z",
			machine_id: "npmplus",
			simulated: false,
			events_count: 2,
			events: [
				{
					timestamp: "2026-09-03T00:00:01Z",
					meta: [
						{ key: "source_ip", value: "203.0.113.50" },
						{ key: "method", value: "GET" },
						{ key: "target_uri", value: "/wp-login.php" },
						{ key: "http_user_agent", value: "curl/8.0" },
						// unknown or sensitive keys must be stripped
						{ key: "raw_request", value: "GET /wp-login.php HTTP/1.1" },
						{ key: "password", value: "hunter2" },
					],
				},
				{
					timestamp: "2026-09-03T00:00:02Z",
					meta: [{ key: "service", value: "http" }],
				},
			],
			// alert-level meta is context summaries; not attacker detail - dropped
			meta: [{ key: "sensitive", value: "not-for-the-browser" }],
			source: {
				ip: "203.0.113.50",
				scope: "Ip",
				value: "203.0.113.50",
				cn: "DE",
				as_number: "64496",
				as_name: "Example ASN",
				range: "203.0.113.0/24",
				rdns: "host.example.com",
				latitude: 51.16,
				longitude: 10.45,
			},
		},
	]);

	assert.deepEqual(alerts, [
		{
			id: 9,
			scenario: "http-bad-user-agent",
			message: "blocked",
			start_at: "2026-09-03T00:00:00Z",
			stop_at: "2026-09-03T00:01:00Z",
			created_at: "2026-09-03T00:01:01Z",
			machine_id: "npmplus",
			simulated: false,
			events_count: 2,
			source: {
				ip: "203.0.113.50",
				scope: "Ip",
				value: "203.0.113.50",
				country: "DE",
				as_number: "64496",
				as_name: "Example ASN",
				range: "203.0.113.0/24",
				rdns: "host.example.com",
				latitude: 51.16,
				longitude: 10.45,
			},
			events: [
				{
					timestamp: "2026-09-03T00:00:01Z",
					meta: [
						{ key: "source_ip", value: "203.0.113.50" },
						{ key: "method", value: "GET" },
						{ key: "target_uri", value: "/wp-login.php" },
						{ key: "http_user_agent", value: "curl/8.0" },
					],
				},
				{
					timestamp: "2026-09-03T00:00:02Z",
					meta: [{ key: "service", value: "http" }],
				},
			],
		},
	]);
});

test("CrowdSec alert history can be searched and filtered without exposing raw events", () => {
	const alerts = normalizeCrowdsecAlerts([
		{
			id: 1,
			scenario: "crowdsecurity/http-probing",
			message: "scan",
			source: { ip: "203.0.113.8", cn: "CA" },
			events: [{ meta: [{ key: "target_host", value: "admin.example.test" }] }],
		},
		{ id: 2, scenario: "crowdsecurity/ssh-bf", source: { ip: "198.51.100.9", cn: "US" } },
	]);
	assert.equal(crowdsecAlertTarget(alerts[0]), "admin.example.test");
	assert.deepEqual(
		filterCrowdsecAlerts(alerts, { country: "ca" }).map(({ id }) => id),
		[1],
	);
	assert.deepEqual(
		filterCrowdsecAlerts(alerts, { scenario: "crowdsecurity/ssh-bf" }).map(({ id }) => id),
		[2],
	);
	assert.deepEqual(
		filterCrowdsecAlerts(alerts, { search: "admin.example" }).map(({ id }) => id),
		[1],
	);
	assert.deepEqual(
		filterCrowdsecAlerts(alerts, { search: "country:ca target:admin.example" }).map(({ id }) => id),
		[1],
	);
	assert.deepEqual(
		filterCrowdsecAlerts(alerts, { search: "scenario:ssh ip:198.51" }).map(({ id }) => id),
		[2],
	);
});

test("Prometheus metrics are parsed and summarized", () => {
	const samples = parsePrometheusText(`
# HELP cs_parser_hits_total parser hits
cs_parser_hits_total{source="nginx"} 10
cs_parser_hits_ok_total{source="nginx"} 8
cs_appsec_reqs_total 12
cs_appsec_block_total 3
cs_lapi_request_duration_seconds_sum 1.5
cs_lapi_request_duration_seconds_count 3
cs_lapi_bouncer_requests_total{bouncer="npmplus"} 4
cs_lapi_decisions_ok_total 3
cs_active_decisions{origin="crowdsec",action="ban"} 2
cs_active_decisions{origin="cscli",action="ban"} 1
cs_active_decisions{origin="CAPI",action="ban"} 50000
cs_active_decisions{origin="lists",action="ban"} 100
not valid
`);
	assert.equal(samples.length, 12);
	assert.deepEqual(samples[0].labels, { source: "nginx" });
	assert.deepEqual(summarizeCrowdsecMetrics(samples), {
		active_decisions: 50103,
		local_active_decisions: 3,
		community_active_decisions: 50100,
		decision_origins: [
			{ name: "capi", count: 50000 },
			{ name: "lists", count: 100 },
			{ name: "crowdsec", count: 2 },
			{ name: "cscli", count: 1 },
		],
		alerts: 0,
		appsec_metrics_present: true,
		appsec_requests: 12,
		appsec_blocked: 3,
		appsec_passed: 9,
		appsec_block_rate: 0.25,
		bouncer_requests: 4,
		bouncer_decision_hits: 3,
		machine_requests: 0,
		parser_hits: 10,
		parser_success_rate: 0.8,
		whitelist_hits: 0,
		average_lapi_ms: 500,
		average_parsing_ms: null,
	});
});

test("decision origin totals degrade safely when an older metric has no origin label", () => {
	const summary = summarizeCrowdsecMetrics(parsePrometheusText("cs_active_decisions 7"));
	assert.equal(summary.active_decisions, 7);
	assert.equal(summary.local_active_decisions, null);
	assert.equal(summary.community_active_decisions, null);
});

test("CrowdSec payload validation rejects malformed upstream responses", () => {
	assert.deepEqual(normalizeCrowdsecDecisions(null), []);
	assert.deepEqual(normalizeCrowdsecAlerts(null), []);
	assert.throws(() => normalizeCrowdsecDecisions({ items: [] }), notArrayPattern);
	assert.throws(() => normalizeCrowdsecAlerts([{ id: 0 }]), missingIdPattern);
});

test("CrowdSec decision IDs must be positive safe integers", () => {
	assert.equal(parseCrowdsecDecisionId(7), 7);
	assert.equal(parseCrowdsecDecisionId("8"), 8);
	assert.equal(parseCrowdsecDecisionId("8.5"), null);
	assert.equal(parseCrowdsecDecisionId(0), null);
	assert.equal(parseCrowdsecDecisionId("not-a-number"), null);
});

test("CrowdSec endpoints require a positive admin permission result", () => {
	assert.equal(hasCrowdsecAdminAccess({ granted: true }), true);
	assert.equal(hasCrowdsecAdminAccess(null), false);
	assert.equal(hasCrowdsecAdminAccess(false), false);
});

test("manual ban input accepts ips, cidr ranges, and valid durations", () => {
	assert.deepEqual(validateManualBan({ value: "192.0.2.10", duration: "4h" }), []);
	assert.deepEqual(validateManualBan({ value: "2001:db8::1", duration: "1h" }), []);
	assert.deepEqual(validateManualBan({ value: "192.0.2.0/24", duration: "7d" }), []);
	assert.deepEqual(validateManualBan({ value: "192.0.2.10", duration: "4h", type: "captcha", reason: "abuse" }), []);
	// reason is optional
	assert.deepEqual(validateManualBan({ value: "192.0.2.10", duration: "4h", reason: "" }), []);
});

test("manual ban input rejects hostile or malformed values", () => {
	assert.deepEqual(validateManualBan({ value: "not an ip", duration: "4h" }), ["value"]);
	assert.deepEqual(validateManualBan({ value: "192.0.2.10", duration: "forever" }), ["duration"]);
	assert.deepEqual(validateManualBan({ value: "192.0.2.10", duration: "4h", type: "delete" }), ["type"]);
	assert.deepEqual(validateManualBan({ value: "192.0.2.10", duration: "4h", reason: "' OR 1=1 --" }), ["reason"]);
	assert.deepEqual(validateManualBan({ value: "http://example.com/", duration: "4h" }), ["value"]);
	// every invalid field is reported together
	assert.deepEqual(validateManualBan({ value: null, duration: "0h", type: "nope" }), ["value", "duration", "type"]);
});
