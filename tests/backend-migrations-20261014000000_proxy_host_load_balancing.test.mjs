import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import { down, up } from "../backend/migrations/20261014000000_proxy_host_load_balancing.js";

const require = createRequire(new URL("../backend/package.json", import.meta.url));
const knexFactory = require("knex");

const parseJson = (value) =>
	typeof value === "string" ? JSON.parse(value) : value;

const withCustomFlags = (servers) => servers.map((server) => ({ custom: false, ...server }));

const migrationReportDirectory = "/data/npmplus/backups";
const migrationReportPrefix = "proxy-host-load-balancing-discarded-paths-";

const readMigrationReports = async () => {
	let names;
	try {
		names = await readdir(migrationReportDirectory);
	} catch (err) {
		if (err.code === "ENOENT") {
			return [];
		}
		throw err;
	}

	return Promise.all(
		names
			.filter((name) => name.startsWith(migrationReportPrefix) && name.endsWith(".json"))
			.map(async (name) => JSON.parse(await readFile(`${migrationReportDirectory}/${name}`, "utf8"))),
	);
};

const createLegacyDatabase = async () => {
	const knex = knexFactory({
		client: "better-sqlite3",
		connection: {
			filename: ":memory:",
		},
		useNullAsDefault: true,
	});

	await knex.schema.createTable("proxy_host", (table) => {
		table.increments("id").primary();
		table.string("forward_scheme");
		table.string("forward_host");
		table.integer("forward_port");
		table.text("locations");
	});

	await knex.schema.createTable("stream", (table) => {
		table.increments("id").primary();
		table.string("forwarding_host");
		table.string("forwarding_port");
	});

	// This migration runs after custom locations have been extracted from
	// proxy_host.locations into their own table.
	await knex.schema.createTable("npmplus_location", (table) => {
		table.increments("id").primary();
		table.integer("proxy_host_id").notNull();
		table.text("path").notNull();
		table.string("forward_scheme").notNull().defaultTo("http");
		table.string("forward_host").notNull().defaultTo("");
		table.integer("forward_port").notNull().defaultTo(0);
		table.text("advanced_config").notNull().defaultTo("");
	});

	return knex;
};

const useLegacyDatabase = async (t) => {
	const knex = await createLegacyDatabase();
	t.after(() => knex.destroy());
	return knex;
};

const proxyHostScenarios = [
	{
		name: "HTTP IPv4 host with a path and numeric port",
		input: { forward_scheme: "http", forward_host: "10.0.0.5/test/path", forward_port: "8080" },
		expectedPath: "/test/path",
		expectedServer: { host: "10.0.0.5", port: 8080 },
	},
	{
		name: "HTTPS domain without a path",
		input: { forward_scheme: "https", forward_host: "example.com", forward_port: 443 },
		expectedPath: null,
		expectedServer: { host: "example.com", port: 443 },
	},
	{
		name: "HTTP host with a bare trailing slash",
		input: { forward_scheme: "http", forward_host: "example.com/", forward_port: "80" },
		expectedPath: "/",
		expectedServer: { host: "example.com", port: 80 },
	},
	{
		name: "HTTP host with an embedded port and path",
		input: { forward_scheme: "http", forward_host: "example.com:8080/test/path", forward_port: 0 },
		expectedPath: "/test/path",
		expectedServer: { host: "example.com:8080" },
	},
	{
		name: "HTTP domain treats the normalized zero port as absent",
		input: { forward_scheme: "http", forward_host: "example.com", forward_port: 0 },
		expectedPath: null,
		expectedServer: { host: "example.com" },
	},
	{
		name: "unbracketed IPv6 host with a path",
		input: {
			forward_scheme: "http",
			forward_host: "fd19:2168:0ab1:1::1/ipv6/path",
			forward_port: "8080",
		},
		expectedPath: "/ipv6/path",
		expectedServer: { host: "[fd19:2168:0ab1:1::1]", port: 8080 },
	},
	{
		name: "bracketed IPv6 host with a path",
		input: {
			forward_scheme: "https",
			forward_host: "[fd19:2168:0ab1:1::1]/ipv6/path",
			forward_port: "443",
		},
		expectedPath: "/ipv6/path",
		expectedServer: { host: "[fd19:2168:0ab1:1::1]", port: 443 },
	},
	{
		name: "gRPC host has its unusable legacy path removed",
		input: { forward_scheme: "grpc", forward_host: "grpc.example.com/ignored/path", forward_port: "50051" },
		expectedPath: null,
		expectedServer: { host: "grpc.example.com", port: 50051 },
	},
	{
		name: "gRPCS host has its unusable legacy path removed",
		input: { forward_scheme: "grpcs", forward_host: "grpc.example.com/ignored/path", forward_port: "50052" },
		expectedPath: null,
		expectedServer: { host: "grpc.example.com", port: 50052 },
	},
	{
		name: "path scheme keeps its host path unchanged",
		input: { forward_scheme: "path", forward_host: "/srv/application/public", forward_port: 0 },
		expectedPath: null,
		expectedServer: { host: "/srv/application/public" },
	},
	{
		name: "empty scheme keeps a Unix socket unchanged",
		input: { forward_scheme: "empty", forward_host: "unix:/run/application.sock", forward_port: 0 },
		expectedPath: null,
		expectedServer: { host: "unix:/run/application.sock" },
	},
	{
		name: "legacy cu_ host becomes a custom upstream and drops its port",
		input: { forward_scheme: "http", forward_host: "cu_external_backend", forward_port: 8080 },
		expectedPath: null,
		expectedServer: { host: "cu_external_backend", custom: true },
	},
];

for (const scenario of proxyHostScenarios) {
	test(`proxy host: ${scenario.name}`, async (t) => {
		const knex = await useLegacyDatabase(t);

		await knex("proxy_host").insert({
			...scenario.input,
			locations: "[]",
		});

		await up(knex);

		const row = await knex("proxy_host").first();
		assert.equal(row.npmplus_forward_path, scenario.expectedPath);
		assert.deepEqual(parseJson(row.npmplus_upstream_servers), withCustomFlags([scenario.expectedServer]));
	});
}

const locationScenarios = [
	{
		name: "HTTP location with a path",
		input: {
			path: "/application",
			forward_scheme: "http",
			forward_host: "10.0.0.6/location/path",
			forward_port: "8081",
			advanced_config: "# retained",
		},
		expected: {
			path: "/application",
			forward_scheme: "http",
			npmplus_forward_path: "/location/path",
			npmplus_upstream_servers: [{ host: "10.0.0.6", port: 8081 }],
			advanced_config: "# retained",
		},
	},
	{
		name: "HTTPS location with unbracketed IPv6 and a path",
		input: {
			path: "/ipv6",
			forward_scheme: "https",
			forward_host: "fd19:2168:0ab1:1::2/location/path",
			forward_port: "443",
		},
		expected: {
			path: "/ipv6",
			forward_scheme: "https",
			npmplus_forward_path: "/location/path",
			npmplus_upstream_servers: [{ host: "[fd19:2168:0ab1:1::2]", port: 443 }],
		},
	},
	{
		name: "gRPC location discards an unusable legacy path",
		input: {
			path: "/grpc",
			forward_scheme: "grpc",
			forward_host: "grpc.example.com/ignored/path",
			forward_port: "50051",
		},
		expected: {
			path: "/grpc",
			forward_scheme: "grpc",
			npmplus_upstream_servers: [{ host: "grpc.example.com", port: 50051 }],
		},
	},
	{
		name: "gRPCS location discards an unusable legacy path",
		input: {
			path: "/grpcs",
			forward_scheme: "grpcs",
			forward_host: "grpc.example.com/ignored/path",
			forward_port: "50052",
		},
		expected: {
			path: "/grpcs",
			forward_scheme: "grpcs",
			npmplus_upstream_servers: [{ host: "grpc.example.com", port: 50052 }],
		},
	},
	{
		name: "path location keeps its filesystem path",
		input: { path: "/static", forward_scheme: "path", forward_host: "/srv/static/files", forward_port: 0 },
		expected: {
			path: "/static",
			forward_scheme: "path",
			npmplus_upstream_servers: [{ host: "/srv/static/files" }],
		},
	},
	{
		name: "empty location keeps a Unix socket",
		input: { path: "/socket", forward_scheme: "empty", forward_host: "unix:/run/location.sock", forward_port: 0 },
		expected: {
			path: "/socket",
			forward_scheme: "empty",
			npmplus_upstream_servers: [{ host: "unix:/run/location.sock" }],
		},
	},
	{
		name: "HTTP location treats the normalized zero port as absent",
		input: { path: "/no-port", forward_scheme: "http", forward_host: "location.example.com", forward_port: 0 },
		expected: {
			path: "/no-port",
			forward_scheme: "http",
			npmplus_upstream_servers: [{ host: "location.example.com" }],
		},
	},
	{
		name: "legacy cu_ location becomes a custom upstream and drops its port",
		input: { path: "/custom", forward_scheme: "http", forward_host: "cu_location_backend", forward_port: 8080 },
		expected: {
			path: "/custom",
			forward_scheme: "http",
			npmplus_upstream_servers: [{ host: "cu_location_backend", custom: true }],
		},
	},
];

for (const scenario of locationScenarios) {
	test(`custom location: ${scenario.name}`, async (t) => {
		const knex = await useLegacyDatabase(t);

		const [proxyHostId] = await knex("proxy_host").insert({
			forward_scheme: "http",
			forward_host: "root.example.com",
			forward_port: "80",
			locations: "[]",
		});
		await knex("npmplus_location").insert({
			proxy_host_id: proxyHostId,
			...scenario.input,
		});

		await up(knex);

		const row = await knex("npmplus_location").first();
		assert.equal(row.path, scenario.expected.path);
		assert.equal(row.forward_scheme, scenario.expected.forward_scheme);
		assert.equal(row.npmplus_forward_path, scenario.expected.npmplus_forward_path ?? null);
		assert.deepEqual(
			parseJson(row.npmplus_upstream_servers),
			withCustomFlags(scenario.expected.npmplus_upstream_servers),
		);
		if (Object.hasOwn(scenario.expected, "advanced_config")) {
			assert.equal(row.advanced_config, scenario.expected.advanced_config);
		}
	});
}

test("reports a discarded gRPC path from a standalone custom location", async (t) => {
	const knex = await useLegacyDatabase(t);
	const originalForwardHost = "grpc-report.example.com/discarded/location/path";
	const [proxyHostId] = await knex("proxy_host").insert({
		forward_scheme: "http",
		forward_host: "root.example.com",
		forward_port: 80,
		locations: "[]",
	});
	const [locationId] = await knex("npmplus_location").insert({
		proxy_host_id: proxyHostId,
		path: "/grpc-report",
		forward_scheme: "grpc",
		forward_host: originalForwardHost,
		forward_port: 50051,
	});

	await up(knex);

	const reports = await readMigrationReports();
	const affected = reports.flatMap((report) => report.affected ?? []);
	assert.ok(affected.some((entry) =>
		entry.proxy_host_id === proxyHostId &&
		entry.scope === "location" &&
		entry.location_id === locationId &&
		entry.location_path === "/grpc-report" &&
		entry.forward_scheme === "grpc" &&
		entry.original_forward_host === originalForwardHost &&
		entry.migrated_upstream_host === "grpc-report.example.com" &&
		entry.discarded_forward_path === "/discarded/location/path"
	));
});

const streamScenarios = [
	{
		name: "IPv4 host with a numeric-string port",
		input: { forwarding_host: "10.0.0.10", forwarding_port: "9000" },
		expectedServer: { host: "10.0.0.10", port: 9000 },
	},
	{
		name: "domain with a blank port",
		input: { forwarding_host: "stream.example.com", forwarding_port: "" },
		expectedServer: { host: "stream.example.com" },
	},
	{
		name: "domain with a zero port",
		input: { forwarding_host: "stream.example.com", forwarding_port: "0" },
		expectedServer: { host: "stream.example.com" },
	},
	{
		name: "domain with a whitespace-only port",
		input: { forwarding_host: "stream.example.com", forwarding_port: "   " },
		expectedServer: { host: "stream.example.com" },
	},
	{
		name: "numeric port surrounded by whitespace is normalised",
		input: { forwarding_host: "stream.example.com", forwarding_port: " 8080 " },
		expectedServer: { host: "stream.example.com", port: 8080 },
	},
	{
		name: "numeric port with leading zeroes is normalised",
		input: { forwarding_host: "stream.example.com", forwarding_port: "0080" },
		expectedServer: { host: "stream.example.com", port: 80 },
	},
	{
		name: "unbracketed IPv6 host",
		input: { forwarding_host: "fd19:2168:0ab1:1::3", forwarding_port: "443" },
		expectedServer: { host: "[fd19:2168:0ab1:1::3]", port: 443 },
	},
	{
		name: "bracketed IPv6 host",
		input: { forwarding_host: "[fd19:2168:0ab1:1::4]", forwarding_port: "8443" },
		expectedServer: { host: "[fd19:2168:0ab1:1::4]", port: 8443 },
	},
	{
		name: "$server_port is retained",
		input: { forwarding_host: "stream.example.com", forwarding_port: "$server_port" },
		expectedServer: { host: "stream.example.com", port: "$server_port" },
	},
	{
		name: "Unix socket is retained",
		input: { forwarding_host: "unix:/run/stream.sock", forwarding_port: null },
		expectedServer: { host: "unix:/run/stream.sock" },
	},
	{
		name: "legacy cu_ host becomes a custom upstream and drops its port",
		input: { forwarding_host: "cu_stream_backend", forwarding_port: "9000" },
		expectedServer: { host: "cu_stream_backend", custom: true },
	},
];

for (const scenario of streamScenarios) {
	test(`stream: ${scenario.name}`, async (t) => {
		const knex = await useLegacyDatabase(t);

		await knex("stream").insert(scenario.input);
		await up(knex);

		const row = await knex("stream").first();
		assert.deepEqual(parseJson(row.npmplus_upstream_servers), withCustomFlags([scenario.expectedServer]));
	});
}

const invalidHosts = [
	{ name: "a null proxy host", table: "proxy_host", host: null },
	{ name: "an empty proxy host", table: "proxy_host", host: "" },
	{ name: "a whitespace-only proxy host", table: "proxy_host", host: "   " },
	{ name: "a null stream host", table: "stream", host: null },
	{ name: "an empty stream host", table: "stream", host: "" },
	{ name: "a whitespace-only stream host", table: "stream", host: "   " },
];

for (const scenario of invalidHosts) {
	test(`rejects ${scenario.name}`, async (t) => {
		const knex = await useLegacyDatabase(t);

		if (scenario.table === "proxy_host") {
			await knex("proxy_host").insert({
				forward_scheme: "http",
				forward_host: scenario.host,
				forward_port: "80",
				locations: "[]",
			});
		} else {
			await knex("stream").insert({
				forwarding_host: scenario.host,
				forwarding_port: "80",
			});
		}

		await assert.rejects(up(knex), {
			name: "TypeError",
			message: "Cannot migrate an upstream with an empty host",
		});
	});
}

for (const host of ["", "   "]) {
	test(`rejects a custom location with ${host ? "a whitespace-only" : "an empty"} host`, async (t) => {
		const knex = await useLegacyDatabase(t);
		const [proxyHostId] = await knex("proxy_host").insert({
			forward_scheme: "http",
			forward_host: "root.example.com",
			forward_port: 80,
			locations: "[]",
		});
		await knex("npmplus_location").insert({
			proxy_host_id: proxyHostId,
			path: "/invalid",
			forward_scheme: "http",
			forward_host: host,
			forward_port: 80,
		});

		await assert.rejects(up(knex), {
			name: "TypeError",
			message: "Cannot migrate an upstream with an empty host",
		});
	});
}

test("migrates every proxy host, custom location, and stream row", async (t) => {
	const knex = await useLegacyDatabase(t);

	await knex("proxy_host").insert([
		{ forward_scheme: "http", forward_host: "first.example.com", forward_port: "80", locations: "[]" },
		{ forward_scheme: "https", forward_host: "second.example.com/path", forward_port: "443", locations: "[]" },
	]);
	const proxyHostIds = await knex("proxy_host").orderBy("id").pluck("id");
	await knex("npmplus_location").insert([
		{
			proxy_host_id: proxyHostIds[0],
			path: "/first",
			forward_scheme: "http",
			forward_host: "10.0.0.30/location",
			forward_port: 8080,
		},
		{
			proxy_host_id: proxyHostIds[1],
			path: "/second",
			forward_scheme: "https",
			forward_host: "10.0.0.31",
			forward_port: 0,
		},
	]);
	await knex("stream").insert([
		{ forwarding_host: "10.0.0.20", forwarding_port: "9000" },
		{ forwarding_host: "10.0.0.21", forwarding_port: "9001" },
	]);

	await up(knex);

	const proxyHosts = await knex("proxy_host").orderBy("id");
	const locations = await knex("npmplus_location").orderBy("id");
	const streams = await knex("stream").orderBy("id");

	assert.equal(proxyHosts.length, 2);
	assert.equal(locations.length, 2);
	assert.equal(streams.length, 2);
	assert.deepEqual(parseJson(proxyHosts[0].npmplus_upstream_servers), [{ host: "first.example.com", port: 80, custom: false }]);
	assert.deepEqual(parseJson(proxyHosts[1].npmplus_upstream_servers), [{ host: "second.example.com", port: 443, custom: false }]);
	assert.equal(proxyHosts[1].npmplus_forward_path, "/path");
	assert.deepEqual(parseJson(locations[0].npmplus_upstream_servers), [{ host: "10.0.0.30", port: 8080, custom: false }]);
	assert.equal(locations[0].npmplus_forward_path, "/location");
	assert.deepEqual(parseJson(locations[1].npmplus_upstream_servers), [{ host: "10.0.0.31", custom: false }]);
	assert.equal(locations[1].npmplus_forward_path, null);
	assert.deepEqual(parseJson(streams[0].npmplus_upstream_servers), [{ host: "10.0.0.20", port: 9000, custom: false }]);
	assert.deepEqual(parseJson(streams[1].npmplus_upstream_servers), [{ host: "10.0.0.21", port: 9001, custom: false }]);
});

test("adds the new columns and removes the legacy columns", async (t) => {
	const knex = await useLegacyDatabase(t);

	await up(knex);

	assert.equal(await knex.schema.hasColumn("proxy_host", "npmplus_upstream_servers"), true);
	assert.equal(await knex.schema.hasColumn("proxy_host", "npmplus_load_balance_method"), true);
	assert.equal(await knex.schema.hasColumn("proxy_host", "npmplus_forward_path"), true);
	assert.equal(await knex.schema.hasColumn("proxy_host", "forward_host"), false);
	assert.equal(await knex.schema.hasColumn("proxy_host", "forward_port"), false);
	assert.equal(await knex.schema.hasColumn("npmplus_location", "npmplus_upstream_servers"), true);
	assert.equal(await knex.schema.hasColumn("npmplus_location", "npmplus_load_balance_method"), true);
	assert.equal(await knex.schema.hasColumn("npmplus_location", "npmplus_forward_path"), true);
	assert.equal(await knex.schema.hasColumn("npmplus_location", "forward_host"), false);
	assert.equal(await knex.schema.hasColumn("npmplus_location", "forward_port"), false);
	assert.equal(await knex.schema.hasColumn("stream", "npmplus_upstream_servers"), true);
	assert.equal(await knex.schema.hasColumn("stream", "npmplus_load_balance_method"), true);
	assert.equal(await knex.schema.hasColumn("stream", "forwarding_host"), false);
	assert.equal(await knex.schema.hasColumn("stream", "forwarding_port"), false);
});

test("new upstream columns default to empty arrays when no legacy rows exist", async (t) => {
	const knex = await useLegacyDatabase(t);

	await up(knex);
	await knex("proxy_host").insert({ locations: "[]" });
	await knex("npmplus_location").insert({ proxy_host_id: 1, path: "/default" });
	await knex("stream").insert({});

	const proxyHost = await knex("proxy_host").first();
	const location = await knex("npmplus_location").first();
	const stream = await knex("stream").first();

	assert.deepEqual(parseJson(proxyHost.npmplus_upstream_servers), []);
	assert.deepEqual(parseJson(location.npmplus_upstream_servers), []);
	assert.deepEqual(parseJson(stream.npmplus_upstream_servers), []);
});

test("down migration is deliberately unsupported", () => {
	assert.throws(() => down({}), /You can't migrate down this one/);
});
