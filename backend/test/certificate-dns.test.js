// Characterization tests for the DNS-challenge certificate flow.
// They pin the CURRENT behavior of internal/certificate.js and
// lib/certbot.js exactly as shipped: if a future change alters the
// certbot invocation, the plugin install, the credentials-file
// handling, or the failure cleanup, these tests must go red BEFORE
// a DNS-01 certificate can break for real.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { test } from "node:test";
import dnsPlugins from "../certbot/dns-plugins.json" with { type: "json" };
import internalCertificate from "../internal/certificate.js";
import { installPlugin } from "../lib/certbot.js";
import utils from "../lib/utils.js";

const CREDENTIALS_DIR = "/tmp/certbot-credentials";

const fakeCertificate = ({ id = 101, domain_names, meta: metaOverrides = {} } = {}) => ({
	id,
	domain_names: domain_names ?? ["example.com", "bücher.example"],
	meta: {
		dns_provider: "cloudflare",
		dns_provider_credentials: "dns_cloudflare_api_token=SECRET-TOKEN",
		...metaOverrides,
	},
});

// certbot reads its config from the environment at request time
process.env.ACME_SERVER = "https://acme-staging-v02.api.letsencrypt.org/directory";

test("dns plugin catalog stays complete: every provider is installable and configurable", () => {
	assert.ok(Object.keys(dnsPlugins).length > 50, "plugin catalog unexpectedly shrank");
	for (const [key, plugin] of Object.entries(dnsPlugins)) {
		assert.ok(plugin.name, `${key}: missing display name`);
		// most plugins are dns-*, but upstream ships a few oddballs (beget,
		// cpanel, dnspod, edgedns, regru) whose plugin names do not match
		assert.ok(plugin.full_plugin_name, `${key}: missing full_plugin_name`);
		assert.ok(plugin.package_name, `${key}: missing pip package_name`);
		assert.equal(typeof plugin.credentials, "string", `${key}: missing credentials template`);
	}
	assert.equal(dnsPlugins.cloudflare.full_plugin_name, "dns-cloudflare");
	assert.equal(dnsPlugins.cloudflare.package_name, "certbot-dns-cloudflare");
});

test("installPlugin pip-installs the catalog package for the provider", async (t) => {
	const calls = [];
	t.mock.method(utils, "execFile", async (cmd, args) => {
		calls.push([cmd, args]);
		return { stdout: "ok" };
	});
	await installPlugin("cloudflare");
	assert.deepEqual(calls, [["pip", ["install", "--upgrade", "--no-cache-dir", "certbot-dns-cloudflare"]]]);
});

test("installPlugin refuses providers that are not in the catalog", async (t) => {
	t.mock.method(utils, "execFile", async () => {
		throw new Error("pip must never run for an unknown provider");
	});
	await assert.rejects(installPlugin("this-plugin-does-not-exist"), /not found|not found in/i);
});

test("dns challenge request invokes certbot with the plugin authenticator and credentials file", async (t) => {
	mkdirSync(CREDENTIALS_DIR, { recursive: true });
	const calls = [];
	t.mock.method(utils, "execFile", async (cmd, args) => {
		calls.push([cmd, args]);
		return { stdout: "ok" };
	});

	await internalCertificate.requestCertbotWithDnsChallenge(fakeCertificate());

	// plugin is installed through pip before certbot runs
	const pipCalls = calls.filter(([cmd]) => cmd === "pip");
	assert.equal(pipCalls.length, 1, "expected exactly one pip install");

	const certbotArgs = calls.find(([cmd]) => cmd === "certbot")?.[1];
	assert.ok(certbotArgs, "certbot was not invoked");
	assert.deepEqual(
		[
			certbotArgs[certbotArgs.indexOf("--config") + 1],
			certbotArgs[certbotArgs.indexOf("certonly")],
			certbotArgs[certbotArgs.indexOf("--server") + 1],
			certbotArgs[certbotArgs.indexOf("--cert-name") + 1],
			certbotArgs[certbotArgs.indexOf("--authenticator") + 1],
			certbotArgs[certbotArgs.indexOf("--dns-cloudflare-credentials") + 1],
			certbotArgs[certbotArgs.indexOf("--domains") + 1],
		],
		[
			"/etc/certbot.ini",
			"certonly",
			process.env.ACME_SERVER,
			"npm-101",
			"dns-cloudflare",
			`${CREDENTIALS_DIR}/credentials-101`,
			"example.com,xn--bcher-kva.example",
		],
		"certbot arguments drifted from the dns-challenge contract",
	);

	// the credentials file carries the operator's secret, mode 0600
	const credentialsPath = `${CREDENTIALS_DIR}/credentials-101`;
	assert.ok(existsSync(credentialsPath), "credentials file was not written");
	assert.equal(readFileSync(credentialsPath, "utf8"), "dns_cloudflare_api_token=SECRET-TOKEN");
	if (process.platform !== "win32") {
		// windows fakes posix modes; the mode check is only honest on posix
		assert.equal(statSync(credentialsPath).mode & 0o777, 0o600, "credentials file must not be world-readable");
	}
});

test("dns challenge request passes propagation seconds when configured", async (t) => {
	mkdirSync(CREDENTIALS_DIR, { recursive: true });
	const calls = [];
	t.mock.method(utils, "execFile", async (cmd, args) => {
		calls.push([cmd, args]);
		return { stdout: "ok" };
	});

	await internalCertificate.requestCertbotWithDnsChallenge(fakeCertificate({ meta: { propagation_seconds: "42" } }));

	const certbotArgs = calls.find(([cmd]) => cmd === "certbot")[1];
	const flagIndex = certbotArgs.indexOf("--dns-cloudflare-propagation-seconds");
	assert.ok(flagIndex > -1, "propagation flag missing");
	assert.equal(certbotArgs[flagIndex + 1], "42");
});

test("dns challenge request cleans up the credentials file when certbot fails", async (t) => {
	mkdirSync(CREDENTIALS_DIR, { recursive: true });
	const credentialsPath = `${CREDENTIALS_DIR}/credentials-777`;
	t.mock.method(utils, "execFile", async (cmd) => {
		if (cmd === "certbot") throw new Error("certbot exploded");
		return { stdout: "ok" };
	});

	await assert.rejects(
		internalCertificate.requestCertbotWithDnsChallenge(fakeCertificate({ id: 777 })),
		/certbot exploded/,
	);
	assert.equal(existsSync(credentialsPath), false, "credentials file leaked after a failed request");
});

test("dns challenge renewal revokes then renews under the same cert-name", async (t) => {
	const calls = [];
	t.mock.method(utils, "execFile", async (cmd, args) => {
		calls.push([cmd, args]);
		return { stdout: "ok" };
	});

	await internalCertificate.renewCertbotWithDnsChallenge(fakeCertificate({ id: 202 }));

	const certbotCalls = calls.filter(([cmd]) => cmd === "certbot");
	assert.equal(certbotCalls.length, 2, "expected revoke + renew");
	const [revokeArgs, renewArgs] = certbotCalls.map(([, args]) => args);
	assert.equal(revokeArgs[revokeArgs.indexOf("--cert-name") + 1], "npm-202");
	assert.equal(revokeArgs[revokeArgs.indexOf("--reason") + 1], "superseded");
	assert.equal(renewArgs[renewArgs.indexOf("--cert-name") + 1], "npm-202");
	assert.ok(renewArgs.includes("--force-renewal"), "renewal must force a new certificate");
});

test("an unknown dns provider fails fast without touching pip or certbot", async (t) => {
	const calls = [];
	t.mock.method(utils, "execFile", async (cmd, args) => {
		calls.push([cmd, args]);
		return { stdout: "ok" };
	});

	await assert.rejects(
		internalCertificate.requestCertbotWithDnsChallenge(
			fakeCertificate({ meta: { dns_provider: "no-such-provider" } }),
		),
		/Unknown DNS provider/,
	);
	await assert.rejects(
		internalCertificate.renewCertbotWithDnsChallenge(
			fakeCertificate({ meta: { dns_provider: "no-such-provider" } }),
		),
		/Unknown DNS provider/,
	);
	assert.deepEqual(calls, [], "no external command may run for an unknown provider");
});
