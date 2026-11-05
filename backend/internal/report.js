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

		return {
			proxy: await internalProxyHost.getCount(userId, access.visibility),
			redirection: await internalRedirectionHost.getCount(userId, access.visibility),
			stream: await internalStream.getCount(userId, access.visibility),
			dead: await internalDeadHost.getCount(userId, access.visibility),
			access_list: await internalAccessList.getCount(userId, access.visibility),
			certificate: await internalCertificate.getCount(userId, access.visibility),
		};
	},
};

export default internalReport;
