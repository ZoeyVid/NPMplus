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
				(existingHostname) => existingHostname.toLowerCase() === hostname.toLowerCase(),
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

		if (!combinedData.certificate_id && !newCert) {
			combinedData.ssl_forced = false;
		}

		if (!combinedData.ssl_forced) {
			combinedData.hsts_enabled = false;
		}

		if (!combinedData.hsts_enabled) {
			combinedData.hsts_subdomains = false;
		}

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
	isHostnameTaken: async (hostname, ignore_type, ignore_id) => {
		const promises = [
			proxyHostModel
				.query()
				.where("is_deleted", 0)
				.andWhere("enabled", 1)
				.andWhere(castJsonIfNeed("domain_names"), "like", `%${hostname}%`),
			redirectionHostModel
				.query()
				.where("is_deleted", 0)
				.andWhere("enabled", 1)
				.andWhere(castJsonIfNeed("domain_names"), "like", `%${hostname}%`),
			deadHostModel
				.query()
				.where("is_deleted", 0)
				.andWhere("enabled", 1)
				.andWhere(castJsonIfNeed("domain_names"), "like", `%${hostname}%`),
		];

		const promises_results = await Promise.all(promises);
		let is_taken = false;

		// Proxy Hosts
		if (
			promises_results[0] &&
			checkHostnameRecordsTaken(
				hostname,
				promises_results[0],
				ignore_type === "proxy" && ignore_id ? ignore_id : 0,
			)
		) {
			is_taken = true;
		}

		// Redirection Hosts
		if (
			promises_results[1] &&
			checkHostnameRecordsTaken(
				hostname,
				promises_results[1],
				ignore_type === "redirection" && ignore_id ? ignore_id : 0,
			)
		) {
			is_taken = true;
		}

		// Dead Hosts
		if (
			promises_results[2] &&
			checkHostnameRecordsTaken(
				hostname,
				promises_results[2],
				ignore_type === "dead" && ignore_id ? ignore_id : 0,
			)
		) {
			is_taken = true;
		}

		return {
			hostname,
			is_taken,
		};
	},
};

export default internalHost;
