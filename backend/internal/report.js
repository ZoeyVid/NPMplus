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

		const promises = [
			internalProxyHost.getCount(userId, access_data.visibility),
			internalRedirectionHost.getCount(userId, access_data.visibility),
			internalStream.getCount(userId, access_data.visibility),
			internalDeadHost.getCount(userId, access_data.visibility),
		];

		const counts = await Promise.all(promises);

		return {
			proxy: counts.shift(),
			redirection: counts.shift(),
			stream: counts.shift(),
			dead: counts.shift(),
		};
	},
};

export default internalReport;
