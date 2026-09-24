import { isIPv6 } from "node:net";
import { migrate as logger } from "../logger.js";

const migrateName = "proxy_host_upstream";

const parseLocations = (locations) => {
	if (Array.isArray(locations)) {
		return locations;
	}

	try {
		const parsed = JSON.parse(locations || "[]");
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
};

const normalisePort = (port) => {
	if (typeof port === "string" && /^[0-9]+$/.test(port)) {
		return Number(port);
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

const createUpstreamServer = (host, port) => ({
	host: normaliseHost(host),
	port: normalisePort(port),
});

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
	});

	await knex.schema.alterTable("stream", (stream) => {
		stream.json("npmplus_upstream_servers").notNull().defaultTo("[]");
		stream.string("npmplus_load_balance_method", 64);
	});

	const proxyHosts = await knex("proxy_host").select("id", "forward_host", "forward_port", "locations");

	for (const proxyHost of proxyHosts) {
		const locations = parseLocations(proxyHost.locations).map((location) => {
				const {forward_host, forward_port, ...otherLocationData } = location;

				return {
					...otherLocationData,
					npmplus_upstream_servers: [
						createUpstreamServer(forward_host, forward_port),
					],
				};
			});

		await knex("proxy_host")
			.where({ id: proxyHost.id })
			.update({
				npmplus_upstream_servers: JSON.stringify([
					createUpstreamServer(proxyHost.forward_host, proxyHost.forward_port),
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

	// this may need to be removed if the goal is to preserve the old tables
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
