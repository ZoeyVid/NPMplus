import { isIPv6 } from "node:net";
import { migrate as logger } from "../logger.js";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const FORWARD_PATH_SCHEMES = ["http", "https"];
const NETWORK_PROXY_SCHEMES = ["http", "https", "grpc", "grpcs"];

const migrationReportDirectory = "/data/npmplus/backups";
const migrateName = "proxy_host_upstream";

const writeDiscardedPathReport = async (discardedPaths) => {
	if (discardedPaths.length === 0) {
		return null;
	}

	await mkdir(migrationReportDirectory, {
		recursive: true,
		mode: 0o700,
	});

	const date = new Date().toISOString().replace(/[:.]/g, "-");
	const reportPath = join(
		migrationReportDirectory,
		`proxy-host-load-balancing-discarded-paths-${date}.json`,
	);

	await writeFile(
		reportPath,
		`${JSON.stringify({
			migration: migrateName,
			generated_at: new Date().toISOString(),
			affected: discardedPaths,
		}, null, 2)}\n`,
		{
			encoding: "utf8",
			mode: 0o600,
			flag: "wx",
		},
	);

	return reportPath;
};

const parseLocations = (locations) => {
	if (Array.isArray(locations)) {
		return locations;
	}
	if (locations === null || locations === undefined || locations === "") {
		return [];
	}
	const parsed = JSON.parse(locations);
	if (!Array.isArray(parsed)) {
		throw new TypeError("Proxy host locations must be an array");
	}
	return parsed;
};

const normalisePort = (port) => {
	if (typeof port === "string") {
		const trimmedPort = port.trim();

		if (trimmedPort === "") {
			return null;
		}
		if (/^[0-9]+$/.test(trimmedPort)) {
			return Number(trimmedPort);
		}
		if (trimmedPort === "$server_port") {
			return trimmedPort;
		}
	}

	return port;
};

const normaliseHost = (host) => {
	if (typeof host !== "string") {
		return host;
	}

	if (host.startsWith("[") && host.endsWith("]")) {
		return host;
	}

	return isIPv6(host) ? `[${host}]` : host;
};

const splitForwardHost = (host, splitPath = false) => {
	if (!splitPath || typeof host !== "string") {
		return {
			upstreamHost: host,
			forwardPath: undefined
		};
	}

	const pathIndex = host.indexOf("/");
	if (pathIndex === -1) {
		return {
			upstreamHost: host,
			forwardPath: undefined
		};
	}

	return {
		upstreamHost: host.slice(0, pathIndex),
		forwardPath: host.slice(pathIndex),
	};
};

const createUpstreamServer = (host, port) => {
	const normalisedPort = normalisePort(port);

	if (typeof host !== "string" || !host.trim()) {
		throw new TypeError("Cannot migrate an upstream with an empty host");
	}

	return {
		host: normaliseHost(host),
		...(normalisedPort === null || normalisedPort === undefined
			? {} : { port: normalisedPort }),
	};
};

/**
 * Adds load-balancing configuration to proxy hosts, custom locations, and streams.
 *
 * @param {Object} knex
 * @returns {Promise}
 */
const up = async (knex) => {
	logger.info(`[${migrateName}] Migrating Up...`);
	const discardedPaths = [];
	await knex.schema.alterTable("proxy_host", (proxyHost) => {
		proxyHost.json("npmplus_upstream_servers").notNull().defaultTo("[]");
		proxyHost.string("npmplus_load_balance_method", 64);
		proxyHost.string("npmplus_forward_path", 255);
	});

	await knex.schema.alterTable("stream", (stream) => {
		stream.json("npmplus_upstream_servers").notNull().defaultTo("[]");
		stream.string("npmplus_load_balance_method", 64);
	});

	const proxyHosts = await knex("proxy_host").select("id", "forward_scheme", "forward_host", "forward_port", "locations");

	for (const proxyHost of proxyHosts) {
		const locations = parseLocations(proxyHost.locations).map((location, locationIndex) => {
				const { forward_host, forward_port, ...otherLocationData } = location;
				const supportsForwardPath = FORWARD_PATH_SCHEMES.includes(location.forward_scheme);
				const { upstreamHost, forwardPath } = splitForwardHost(
					forward_host,
					NETWORK_PROXY_SCHEMES.includes(location.forward_scheme)
				);

				// grpc and grpcs were not used previously and this discards the paths so store it for the output
				// so users can see which hosts had a "destructive" migration rather than discarding it silently
				// forward path on a grpc/grpcs scheme was like the human appendix. maybe once it was useful,
				// but it wasn't really used for anything critical
				if (forwardPath && !supportsForwardPath) {
					discardedPaths.push({
						proxy_host_id: proxyHost.id,
						scope: "location",
						location_index: locationIndex,
						location_path: location.path ?? null,
						forward_scheme: location.forward_scheme,
						original_forward_host: forward_host,
						migrated_upstream_host: upstreamHost,
						discarded_forward_path: forwardPath,
					});
				}

				return {
					...otherLocationData,
					...(supportsForwardPath  && forwardPath ? { npmplus_forward_path: forwardPath } : {}),
					npmplus_upstream_servers: [
						createUpstreamServer(upstreamHost, forward_port),
					],
				};
			});

		const supportsForwardPath = FORWARD_PATH_SCHEMES.includes(proxyHost.forward_scheme);
		const { upstreamHost, forwardPath } = splitForwardHost(
			proxyHost.forward_host,
			NETWORK_PROXY_SCHEMES.includes(proxyHost.forward_scheme),
		);

		// grpc and grpcs were not used previously and this discards the paths so store it for the output
		// so users can see which hosts had a "destructive" migration rather than discarding it silently
		// forward path on a grpc/grpcs scheme was like the human appendix. maybe once it was useful,
		// but it wasn't really used for anything critical
		if (forwardPath && !supportsForwardPath) {
			discardedPaths.push({
				proxy_host_id: proxyHost.id,
				scope: "proxy_host",
				location_index: null,
				location_path: null,
				forward_scheme: proxyHost.forward_scheme,
				original_forward_host: proxyHost.forward_host,
				migrated_upstream_host: upstreamHost,
				discarded_forward_path: forwardPath,
			});
		}

		await knex("proxy_host")
			.where({ id: proxyHost.id })
			.update({
				npmplus_forward_path: supportsForwardPath ? forwardPath ?? null : null,
				npmplus_upstream_servers: JSON.stringify([
					createUpstreamServer(upstreamHost, proxyHost.forward_port)
				]),
				locations: JSON.stringify(locations),
			});
	}

	const streams = await knex("stream").select("id", "forwarding_host", "forwarding_port");

	for (const stream of streams) {
		await knex("stream")
			.where({ id: stream.id })
			.update({
				npmplus_upstream_servers: JSON.stringify([
					createUpstreamServer(stream.forwarding_host, stream.forwarding_port),
				]),
			});
	}

	const reportPath = await writeDiscardedPathReport(discardedPaths);

	if (reportPath !== null) {
		logger.warn(
			`[${migrateName}] Discarded unsupported gRPC/gRPCS forward paths from ` +
			`${discardedPaths.length} configuration(s). Details written to ${reportPath}`,
		);
	}

	// this may need to be removed if the goal is to preserve the old tables. Possibly for compatibility with the upstream
	// NPM repo
	await knex.schema.alterTable("proxy_host", (proxyHost) => {
		proxyHost.dropColumns("forward_host", "forward_port");
	});

	await knex.schema.alterTable("stream", (stream) => {
		stream.dropColumns("forwarding_host", "forwarding_port");
	});

	logger.info(`[${migrateName}] proxy_host and stream Tables altered`);
};

/**
 * @param {Object} knex
 * @returns {Promise}
 */
const down = (_knex) => {
	throw new Error(`[${migrateName}] You can't migrate down this one.`);
};

export { down, up };
