import { domainToASCII, domainToUnicode } from "node:url";
import { castJsonIfNeed } from "../lib/helpers.js";
import deadHostModel from "../models/dead_host.js";
import proxyHostModel from "../models/proxy_host.js";
import redirectionHostModel from "../models/redirection_host.js";

/**
 * @param   {String}  hostname
 * @param   {Array}   existingRows
 * @param   {Integer} [ignoreId]
 * @returns {Boolean}
 */
const checkHostnameRecordsTaken = (hostname, existingRows, ignoreId) =>
	(existingRows || []).some(
		(existingRow) =>
			(!ignoreId || ignoreId !== existingRow.id) &&
			// Does this domain match?
			existingRow.domain_names.some(
				(existingHostname) =>
					(domainToASCII(existingHostname) || existingHostname).toLowerCase() ===
					(domainToASCII(hostname) || hostname).toLowerCase(),
			),
	);

const internalHost = {
	/**
	 * Makes sure that the ssl_* and hsts_* fields play nicely together.
	 * ie: if there is no cert, then force_ssl is off.
	 *     if force_ssl is off, then hsts_enabled is definitely off.
	 *     if hsts_enabled is off, then hsts_subdomains is definitely off.
	 *
	 * @param   {object} data
	 * @param   {object} [existing_data]
	 * @returns {object}
	 */
	cleanSslHstsData: (newCert, data, existingData) => {
		const combinedData = { ...existingData, ...data };

		if (!(combinedData.certificate_id > 0) && !newCert) {
			combinedData.ssl_forced = false;
			combinedData.npmplus_http3_support = false;
			combinedData.npmplus_mtls_certificate_id = 0;
		}

		if (!(combinedData.npmplus_mtls_certificate_id > 0)) {
			combinedData.npmplus_mtls_verify_client_optional = false;
		}

		if (combinedData.npmplus_mtls_certificate_id > 0 && !combinedData.npmplus_mtls_verify_client_optional) {
			combinedData.ssl_forced = true;
		}

		if (!combinedData.ssl_forced) {
			combinedData.hsts_enabled = false;
		}

		if (!combinedData.hsts_enabled) {
			combinedData.hsts_subdomains = false;
		}

		combinedData.npmplus_mtls_bypass_auth_request &&=
			combinedData.npmplus_mtls_certificate_id > 0 &&
			combinedData.npmplus_mtls_verify_client_optional === true &&
			[combinedData, ...(combinedData.locations ?? [])].some(
				({ npmplus_auth_request = "none" }) => npmplus_auth_request !== "none",
			);

		return combinedData;
	},

	/**
	 * Internal use only, checks to see if the domain is already taken by any other record
	 *
	 * @param   {String}   hostname
	 * @param   {String}   [ignore_type]   'proxy', 'redirection', 'dead'
	 * @param   {Integer}  [ignore_id]     Must be supplied if type was also supplied
	 * @returns {Promise}
	 */
	isHostnameTaken: async (hostname, ignore_type, ignore_id) => ({
		hostname,
		is_taken: (
			await Promise.all(
				Object.entries({ proxy: proxyHostModel, redirection: redirectionHostModel, dead: deadHostModel }).map(
					async ([type, model]) =>
						checkHostnameRecordsTaken(
							hostname,
							await model
								.query()
								.where("enabled", 1)
								.andWhere((query) =>
									query
										.whereILike(
											castJsonIfNeed("domain_names"),
											`%${domainToASCII(hostname) || hostname}%`,
										)
										.orWhereILike(
											castJsonIfNeed("domain_names"),
											`%${domainToUnicode(hostname) || hostname}%`,
										),
								),
							ignore_type === type && ignore_id ? ignore_id : 0,
						),
				),
			)
		).includes(true),
	}),
};

export default internalHost;
