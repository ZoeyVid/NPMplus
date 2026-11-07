import { toAsciiDomain } from "../lib/helpers.js";
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
					toAsciiDomain(existingHostname).toLowerCase() === toAsciiDomain(hostname).toLowerCase(),
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
				({ npmplus_auth_request = "none" }) => !["none", "global"].includes(npmplus_auth_request),
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
	isHostnameTaken: async (hostname, ignore_type, ignore_id) => {
		for (const [type, model] of Object.entries({
			proxy: proxyHostModel,
			redirection: redirectionHostModel,
			dead: deadHostModel,
		})) {
			if (
				checkHostnameRecordsTaken(
					hostname,
					await model.query().where("enabled", 1),
					ignore_type === type && ignore_id ? ignore_id : 0,
				)
			) {
				return { hostname, is_taken: true };
			}
		}
		return { hostname, is_taken: false };
	},

	checkCustomConfig: (access, data, existingData = {}) => {
		for (const field of ["advanced_config", "npmplus_location_config", "npmplus_advanced_config"]) {
			if (data[field] !== undefined && data[field] !== (existingData[field] ?? "")) access.canAdmin();
		}
		for (const location of data.locations ?? []) {
			if (
				location.advanced_config &&
				location.advanced_config !==
					existingData.locations?.find(
						(existing) =>
							existing.path === location.path &&
							existing.location_type === (location.location_type ?? ""),
					)?.advanced_config
			) {
				access.canAdmin();
			}
		}
		for (const domain of data.domain_names ?? []) {
			if (domain.startsWith("~") && !existingData.domain_names?.includes(domain)) access.canAdmin();
		}
	},

	checkForwardTarget: (access, data, existingData = {}) => {
		const items = [[{ ...existingData, ...data }, existingData]];
		for (const location of data.locations ?? []) {
			items.push([
				location,
				existingData.locations?.find(
					(existing) =>
						existing.path === location.path && existing.location_type === (location.location_type ?? ""),
				) ?? {},
			]);
		}
		for (const [item, existing] of items) {
			if (
				item.forward_scheme === "path" &&
				(existing.forward_scheme !== "path" ||
					item.forward_host !== existing.forward_host ||
					item.forward_port !== existing.forward_port)
			) {
				access.canAdmin();
			}
			if (item.forward_host?.toLowerCase().startsWith("unix:") && item.forward_host !== existing.forward_host) {
				access.canAdmin();
			}
			if (
				item.forwarding_host?.toLowerCase().startsWith("unix:") &&
				item.forwarding_host !== existing.forwarding_host
			) {
				access.canAdmin();
			}
		}
	},
};

export default internalHost;
