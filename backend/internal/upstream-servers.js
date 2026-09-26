import { isIPv6 } from "node:net";
import errs from "../lib/error.js";

const BACKUP_INCOMPATIBLE_METHODS = [
	"hash",
	"hash_consistent",
	"ip_hash",
	"random",
	"random_two_least_connections",
	"random_two_least_time_connect",
	"random_two_least_time_header",
	"random_two_least_time_first_byte",
	"random_two_least_time_last_byte",
];
const SINGLE_UPSTREAM_SCHEMES = ["path", "empty"];
const FORWARD_PATH_SCHEMES = ["http", "https"];
const NETWORK_PROXY_SCHEMES = ["http", "https", "grpc", "grpcs"];

const normaliseHost = (host) => {
	if (typeof host !== "string") {
		return host;
	}

	const pathIndex = host.indexOf("/");
	const address = pathIndex === -1 ? host : host.slice(0, pathIndex);
	const path = pathIndex === -1 ? "" : host.slice(pathIndex);

	if (address.startsWith("[") && address.endsWith("]")) {
		return host;
	}

	return isIPv6(address) ? `[${address}]${path}` : host;
};

const internalUpstreamServers = {

	/**
	 * 
	 * @param {*} serverHost 
	 * @returns 
	 */
	cleanUpstreamServers: (serverHost, isLocation = false) => {
		if (Array.isArray(serverHost.npmplus_upstream_servers)) {
			for (const server of serverHost.npmplus_upstream_servers) {
				server.host = normaliseHost(server.host);
			}
		}

		// always remove the load balance method if there is only 1 item in the array
		// however if it is not a location and it is changing from more than 1 to 1 host,
		// then set it to null so objection will update the field
		if (Array.isArray(serverHost.npmplus_upstream_servers) &&
			serverHost.npmplus_upstream_servers.length === 1) {
			if (isLocation) {
				delete serverHost.npmplus_load_balance_method;
			} else {
				serverHost.npmplus_load_balance_method = null;
			}
		}
		// streams do not have locations and some hosts may not have them either so do a check before trying to iterate
		if (Array.isArray(serverHost.locations)) {
			for (const location of serverHost.locations) {
				internalUpstreamServers.cleanUpstreamServers(location, true);
			}
		}
		return serverHost;
	},

	/**
	 * 
	 * @param {*} serverHost
	 * @param {*} existingServerHost
	 */
	validateLoadBalancing: (serverHost, existingServerHost = {}, streams = false) => {
		// use hasOwn to verify if it was specified as null deliberately (clean functions) or is actually missing
		const upstreamServers = Object.hasOwn(serverHost, "npmplus_upstream_servers")
			? serverHost.npmplus_upstream_servers
			: existingServerHost.npmplus_upstream_servers || [];

		const loadBalanceMethod = Object.hasOwn(serverHost, "npmplus_load_balance_method")
			? serverHost.npmplus_load_balance_method
			: existingServerHost.npmplus_load_balance_method;

		const forwardScheme = Object.hasOwn(serverHost, "forward_scheme")
			? serverHost.forward_scheme
			: existingServerHost.forward_scheme;

		const forwardPath = Object.hasOwn(serverHost, "npmplus_forward_path")
			? serverHost.npmplus_forward_path
			: existingServerHost.npmplus_forward_path;

		if (forwardPath != null && !FORWARD_PATH_SCHEMES.includes(forwardScheme)) {
			throw new errs.ValidationError(`A forward path cannot be used with the ${forwardScheme} scheme`);
		}

		if (!streams && SINGLE_UPSTREAM_SCHEMES.includes(forwardScheme) && upstreamServers.length !== 1) {
			throw new errs.ValidationError(`${forwardScheme} proxy hosts must have exactly one upstream server`);
		}

		const usesServerPort = upstreamServers.some((server) => server.port === "$server_port");
		if (usesServerPort && (!streams || upstreamServers.length !== 1 || upstreamServers[0].port !== "$server_port")) {
			throw new errs.ValidationError("$server_port can only be used by a stream with exactly one upstream server");
		}

		if (!streams && NETWORK_PROXY_SCHEMES.includes(forwardScheme) && upstreamServers.some((server) => server.host.includes("/"))) {
			throw new errs.ValidationError("Network upstream hosts cannot contain a path; use the forward path field instead");
		}

		if (upstreamServers.length > 1 && !loadBalanceMethod) {
			throw new errs.ValidationError("A load balancing method is required when multiple upstream servers are configured");
		}

		if (upstreamServers.length === 1 && loadBalanceMethod != null) {
			throw new errs.ValidationError("A load balancing method cannot be used with a single upstream server");
		}

		if (BACKUP_INCOMPATIBLE_METHODS.includes(loadBalanceMethod) &&
			upstreamServers.some((server) => server.backup)) {
			throw new errs.ValidationError(`The backup parameter cannot be used with the ${loadBalanceMethod} load balancing method`);
		}

		// streams do not have locations and some hosts may not have them either so do a check before trying to iterate
		if (Array.isArray(serverHost.locations)) {
			for (const location of serverHost.locations) {
				internalUpstreamServers.validateLoadBalancing(location);
			}
		}
	},
};

export default internalUpstreamServers;
