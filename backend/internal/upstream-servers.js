		
        
const internalUpstreamServers = {

	/**
	 * @param   {Object}  serverHost
	 * @returns {Promise}
	 */
	cleanUpstreamServers: (serverHost) => {
        // always remove the load balance method if there is only 1 item in the array
		if (Array.isArray(serverHost.npmplus_upstream_servers) &&
			serverHost.npmplus_upstream_servers.length === 1) {
			serverHost.npmplus_load_balance_method = null;
		}
		return serverHost;
    },
};
export default internalUpstreamServers;


        