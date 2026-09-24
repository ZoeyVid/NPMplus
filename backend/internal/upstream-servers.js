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

const internalUpstreamServers = {

	/**
	 * 
	 * @param {*} serverHost 
	 * @returns 
	 */
	cleanUpstreamServers: (serverHost) => {
		// always remove the load balance method if there is only 1 item in the array
		if (Array.isArray(serverHost.npmplus_upstream_servers) &&
			serverHost.npmplus_upstream_servers.length === 1) {
			serverHost.npmplus_load_balance_method = null;
		}
		// streams do not have locations and some hosts may not have them either so do a check before trying to iterate
		if (Array.isArray(serverHost.locations)) {
			for (const location of serverHost.locations) {
				internalUpstreamServers.cleanUpstreamServers(location);
			}
		}
		return serverHost;
	},

	/**
	 * 
	 * @param {*} serverHost
	 * @param {*} existingServerHost
	 */
	validateLoadBalancing: (serverHost, existingServerHost = {}) => {
		// use hasOwn to verify if it was specified as null deliberately (clean functions) or is actually missing
		const upstreamServers = Object.hasOwn(serverHost, "npmplus_upstream_servers")
			? serverHost.npmplus_upstream_servers
			: existingServerHost.npmplus_upstream_servers || [];

		const loadBalanceMethod = Object.hasOwn(serverHost, "npmplus_load_balance_method")
			? serverHost.npmplus_load_balance_method
			: existingServerHost.npmplus_load_balance_method;

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
