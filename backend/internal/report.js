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
		const access_data = await access.can("reports:hosts", 1);

		const userId = access.token.getUserId(1);

		const [proxy, redirection, stream, dead] = await Promise.all([
			internalProxyHost.getCount(userId, access_data.permission_visibility),
			internalRedirectionHost.getCount(userId, access_data.permission_visibility),
			internalStream.getCount(userId, access_data.permission_visibility),
			internalDeadHost.getCount(userId, access_data.permission_visibility),
		]);

		return { proxy, redirection, stream, dead };
	},
};

export default internalReport;
