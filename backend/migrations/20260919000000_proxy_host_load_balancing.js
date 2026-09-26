import { isIPv6 } from "node:net";
import { migrate as logger } from "../logger.js";

const migrateName = "proxy_host_upstream";

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
		if (port.trim() === "") {
			return null;
		} else if (/^[0-9]+$/.test(port)) {
			return Number(port);
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
		const locations = parseLocations(proxyHost.locations).map((location) => {
				const { forward_host, forward_port, ...otherLocationData } = location;
				const { upstreamHost, forwardPath } = splitForwardHost(
					forward_host,
					!["path", "empty"].includes(location.forward_scheme),
				);

				return {
					...otherLocationData,
					...(forwardPath ? { npmplus_forward_path: forwardPath } : {}),
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
