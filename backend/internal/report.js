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
	getHostsReport: async (access) => ({
		proxy: await internalProxyHost.getCount(access),
		redirection: await internalRedirectionHost.getCount(access),
		stream: await internalStream.getCount(access),
		dead: await internalDeadHost.getCount(access),
		access_list: await internalAccessList.getCount(access),
		certificate: await internalCertificate.getCount(access),
	}),
};

export default internalReport;
