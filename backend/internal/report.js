import internalDeadHost from "./dead-host.js";
import internalProxyHost from "./proxy-host.js";
import internalRedirectionHost from "./redirection-host.js";
import internalStream from "./stream.js";

const internalReport = {
	/**
	 * @param  {Access}   access
	 * @return {Promise}
	 */
	getHostsReport: async (access) => {
		const userId = access.token.getUserId(1);

		const [proxy, redirection, stream, dead] = await Promise.all([
			internalProxyHost.getCount(userId, access.visibility),
			internalRedirectionHost.getCount(userId, access.visibility),
			internalStream.getCount(userId, access.visibility),
			internalDeadHost.getCount(userId, access.visibility),
		]);

		return { proxy, redirection, stream, dead };
	},
};

export default internalReport;
