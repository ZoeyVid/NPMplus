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

/**
 * @param   {Array}   hosts
 * @param   {Array}   domainNames
 * @returns {Array}
 */
const getHostsWithDomains = (hosts, domainNames) => {
	const wanted = new Set(domainNames.map((domainName) => domainName.toLowerCase()));

	return (hosts || []).filter((host) =>
		host.domain_names.some((hostDomainName) => wanted.has(hostDomainName.toLowerCase())),
	);
};

const internalHost = {
	/**
	 * Makes sure that the ssl_* and hsts_* fields play nicely together.
	 * ie: if there is no cert, then force_ssl is off.
	 *     if force_ssl is off, then hsts_enabled is definitely off.
	 *
	 * @param   {object} data
	 * @param   {object} [existing_data]
	 * @returns {object}
	 */
	cleanSslHstsData: (newCert, data, existingData) => {
		const combinedData = { ...existingData, ...data };

		if (!combinedData.certificate_id && !newCert) {
			combinedData.hsts_subdomains = false;
			combinedData.ssl_forced = false;
		}

		if (!combinedData.ssl_forced) {
			combinedData.hsts_enabled = false;
		}

		return combinedData;
	},

	/**
	 * used by the getAll functions of hosts, this removes the certificate meta if present
	 *
	 * @param   {Array}  rows
	 * @returns {Array}
	 */
	cleanAllRowsCertificateMeta: (rows) => {
		for (const row of rows) {
			if (row.certificate) {
				row.certificate.meta = {};
			}
		}

		return rows;
	},

	/**
	 * used by the get/update functions of hosts, this removes the certificate meta if present
	 *
	 * @param   {Object}  row
	 * @returns {Object}
	 */
	cleanRowCertificateMeta: (row) => {
		if (typeof row.certificate !== "undefined" && row.certificate) {
			row.certificate.meta = {};
		}

		return row;
	},

	/**
	 * This returns all the host types with any domain listed in the provided domainNames array.
	 * This is used by the certificates to temporarily disable any host that is using the domain
	 *
	 * @param   {Array}  domainNames
	 * @returns {Promise}
	 */
	getHostsWithDomains: async (domainNames) => {
		const responseObject = {
			total_count: 0,
			dead_hosts: [],
			proxy_hosts: [],
			redirection_hosts: [],
		};

		const proxyRes = await proxyHostModel.query().where("is_deleted", 0);
		responseObject.proxy_hosts = getHostsWithDomains(proxyRes, domainNames);
		responseObject.total_count += responseObject.proxy_hosts.length;

		const redirRes = await redirectionHostModel.query().where("is_deleted", 0);
		responseObject.redirection_hosts = getHostsWithDomains(redirRes, domainNames);
		responseObject.total_count += responseObject.redirection_hosts.length;

		const deadRes = await deadHostModel.query().where("is_deleted", 0);
		responseObject.dead_hosts = getHostsWithDomains(deadRes, domainNames);
		responseObject.total_count += responseObject.dead_hosts.length;

		return responseObject;
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
