import internalAccessList from "./access-list.js";
import internalCertificate from "./certificate.js";
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

		const [proxy, redirection, stream, dead, access_list, certificate] = await Promise.all([
			internalProxyHost.getCount(userId, access.visibility),
			internalRedirectionHost.getCount(userId, access.visibility),
			internalStream.getCount(userId, access.visibility),
			internalDeadHost.getCount(userId, access.visibility),
			internalAccessList.getCount(userId, access.visibility),
			internalCertificate.getCount(userId, access.visibility),
		]);

		return { proxy, redirection, stream, dead, access_list, certificate };
	},
};

export default internalReport;
