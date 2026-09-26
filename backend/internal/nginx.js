import { rename, rm, writeFile } from "node:fs/promises";
import { Client, fetch } from "undici";
import errs from "../lib/error.js";
import { toAsciiDomain } from "../lib/helpers.js";
import updateOcspStaples from "../lib/ocsp.js";
import utils from "../lib/utils.js";
import { nginx as logger } from "../logger.js";
import internalProxyHostAccessList from "./proxy-host-access-list.js";

const controlApi = new Client("http://localhost", { connect: { socketPath: "/run/nginx-control.sock" } });
const authRequestProviders = ["anubis", "tinyauth", "oauth2proxy", "voidauth", "authelia", "authentik"];
const rawPlaceholderPattern = /^[ \t]*npmplus#raw#(?<index>\d+);$/gmu;

const NETWORK_PROXY_SCHEMES = ["http", "https", "grpc", "grpcs"];

const prepareUpstreamServers = (serverHost, stream = false) => {
	const upstreamServers = serverHost.npmplus_upstream_servers;

	if (!Array.isArray(upstreamServers) || upstreamServers.length === 0) {
		return;
	}

	const firstPort = upstreamServers[0].port;

	for (const [index, server] of upstreamServers.entries()) {
		if (index > 0 && server.port == null && firstPort != null) {
			server.port = firstPort;
		}

		if (!stream &&
			NETWORK_PROXY_SCHEMES.includes(serverHost.forward_scheme) &&
			!server.host.startsWith("/") &&
			!server.host.startsWith("unix")) {
			const pathIndex = server.host.indexOf("/");

			if (pathIndex !== -1) {
				server.forward_path = server.host.slice(pathIndex);
				server.host = server.host.slice(0, pathIndex);

				if (index === 0) {
					serverHost.forward_path = server.forward_path;
				}
			}
		}
	}
};

const internalNginx = {
	/**
	 * This will:
	 * - test the nginx config first to make sure it's OK
	 * - create / recreate the config for the host
	 * - test again
	 * - IF OK:  save the online status
	 * - IF BAD: save the offline status and rename the config
	 * - then reload nginx
	 *
	 * @param   {Object|String}  model
	 * @param   {String}         host_type
	 * @param   {Object}         host
	 * @returns {Promise}
	 */
	configure: async (model, host_type, host, { skipReload = false, trx } = {}) => {
		let status = {};

		// skip disabled hosts
		if (!host.enabled) return status;

		await internalProxyHostAccessList.build(host_type, host);
		await internalNginx.deleteConfig(host_type, host);

		try {
			await internalNginx.generateConfig(host_type, host);
			await (skipReload ? internalNginx.test() : internalNginx.reload());
			status = { npmplus_nginx_online: true, npmplus_nginx_err: "" };

			await model.query(trx).where("id", host.id).patch(status);
		} catch (err) {
			if (trx) throw err;
			logger.error(err.message);

			// config is bad, update status and rename config
			status = { npmplus_nginx_online: false, npmplus_nginx_err: err.message };

			await model.query().where("id", host.id).patch(status);

			await internalNginx.renameConfigAsError(host_type, host);
			if (!skipReload) await internalNginx.reload();
		}

		return status;
	},

	/**
	 * @returns {Promise}
	 */
	test: () => utils.execFile("nginx", ["-tq"]),

	/**
	 * @returns {Promise}
	 */
	reload: async () => {
		const promises = [];
		if (process.env.ACME_OCSP_STAPLING === "true") promises.push(updateOcspStaples("/data/tls/certbot/live"));
		if (process.env.CUSTOM_OCSP_STAPLING === "true") promises.push(updateOcspStaples("/data/tls/custom"));
		await Promise.all(promises);

		const res = await fetch("http://localhost/1/control/config", { method: "PATCH", dispatcher: controlApi });
		const logs = (await res.json()).logs.join("").trim();
		if (!res.ok) {
			throw new errs.CommandError(logs || `nginx reload failed with status ${res.status}, see container logs`);
		}
		return logs;
	},

	/**
	 * @param   {String}  host_type
	 * @param   {Integer} host_id
	 * @returns {String}
	 */
	getConfigName: (host_type, host_id) => {
		if (host_type === "default") {
			return "/data/nginx/default.conf";
		}
		return `/data/nginx/${host_type}/${host_id}.conf`;
	},

	/**
	 * Generates custom locations
	 * @param   {Object}  host
	 * @returns {Promise}
	 */
	renderLocations: async (host) => {
		let renderedLocations = "";

		for (const [idx, location] of (host.locations || []).entries()) {
			if (location.npmplus_enabled === false) {
				continue;
			}

			const firstServer = location.npmplus_upstream_servers?.[0];

			if (firstServer?.host.startsWith("cu_")) {
				location.forward_upstream_name = firstServer.host;
			} else {
				location.forward_upstream_name = `upstream_${host.id}_location_${idx}`;
			}
			if (["~", "~*"].includes(location.location_type)) {
				location.path = utils.nginxQuote(`${location.location_type}${location.path}`);
			} else if (["@", "=", "~", "~*", "^~", "$"].some((prefix) => location.path.startsWith(prefix))) {
				throw new errs.ValidationError(`${JSON.stringify(location.path)} can not be used as a location path`);
			} else {
				location.path = `${utils.assertNginxValue(location.location_type)}${utils.assertNginxValue(location.path)}`;
			}
			renderedLocations += await utils.renderEngine.renderFile("_proxy_host_custom_location.conf", location);
		}

		return renderedLocations;
	},

	/**
	 * Generates upstream blocks for main host and custom locations
	 * @param   {Object}  host
	 * @returns {Promise}
	 */
	renderUpstreams: async (host) => {
		let renderedUpstreams = "";

		if (NETWORK_PROXY_SCHEMES.includes(host.forward_scheme)) {
			const firstServer = host.npmplus_upstream_servers?.[0];
			if (firstServer?.host.startsWith("cu_")) {
				host.forward_upstream_name = firstServer.host;
			} else {
				host.forward_upstream_name = `upstream_${host.id}`;
				renderedUpstreams += await utils.renderEngine.renderFile("_upstream.conf", host);
			}
		}

		for (const [idx, location] of (host.locations || []).entries()) {
			if (location.npmplus_enabled === false) {
				continue;
			}

			if (!NETWORK_PROXY_SCHEMES.includes(location.forward_scheme)) {
				continue;
			}
			const firstServer = location.npmplus_upstream_servers?.[0];
			if (firstServer?.host.startsWith("cu_")) {
				location.forward_upstream_name = firstServer.host;
			} else {
				location.forward_upstream_name = `upstream_${host.id}_location_${idx}`;
				renderedUpstreams += await utils.renderEngine.renderFile("_upstream.conf", location);
			}
		}

		return renderedUpstreams;
	},

	/**
	 * @param   {String}  host_type
	 * @param   {Object}  host
	 * @returns {Promise}
	 */
	generateConfig: async (host_type, host_row) => {
		// Prevent modifying the original object:
		const host = structuredClone(host_row);
		const raws = [];
		for (const item of [host, ...(host.locations ?? [])]) {
			for (const field of ["advanced_config", "npmplus_location_config", "npmplus_advanced_config"]) {
				if (item[field]) item[field] = `npmplus#raw#${raws.push(item[field]) - 1};`;
			}
		}

		const filename = internalNginx.getConfigName(host_type, host.id);

		host.env = process.env;

		if (nice_host_type === "proxy_host") {
			prepareUpstreamServers(host);

			for (const location of host.locations || []) {
				prepareUpstreamServers(location);
			}
		} else if (nice_host_type === "stream") {
			prepareUpstreamServers(host, true);
		}

		if (host.domain_names) {
			host.server_names = host.domain_names.map((domain) => utils.nginxQuote(toAsciiDomain(domain)));
		}
		if (host.npmplus_access_list_type === "custom") {
			// note that there is access_lists -> an array in the correct order
			// and access_list -> an object used in the config generation
			// note the (s) in the former and lack thereof in the latter
			host.access_list = internalProxyHostAccessList.buildAclFile(host.access_lists);
		}
		const hostHtpasswdFileName = internalProxyHostAccessList.getHostFileName(host);
		if (hostHtpasswdFileName.length > 0) {
			host.filename = hostHtpasswdFileName;
		}

		host.upstreams = await internalNginx.renderUpstreams(host);

		if (host.locations) {
			for (const location of host.locations) {
				if (location.npmplus_auth_request === "global") {
					location.npmplus_auth_request = host.npmplus_auth_request;
				}
				if (location.npmplus_access_list_type === "global") {
					location.access_list = host.access_list;
				} else if (location.npmplus_access_list_type === "custom") {
					// note that there is access_lists -> an array in the correct order
					// and access_list -> an object used in the config generation
					// note the (s) in the former and lack thereof in the latter
					location.access_list = internalProxyHostAccessList.buildAclFile(location.access_lists);
				}

				const htpasswdFileName = internalProxyHostAccessList.getLocationFileName(host, location);
				if (htpasswdFileName.length > 0) {
					location.filename = htpasswdFileName;
				}
				if (location.npmplus_enabled === false) continue;
				if (location.path === "/.well-known/acme-challenge/" && ["", "^~"].includes(location.location_type)) {
					host.custom_acme_challenge_location = true;
				}
				const provider =
					location.npmplus_auth_request === "authentik-send-basic-auth"
						? "authentik"
						: location.npmplus_auth_request;
				if (authRequestProviders.includes(provider)) host[`create_${provider}_locations`] = true;
			}

			const originalLocations = [...host.locations];
			host.locations = await internalNginx.renderLocations(host);

			for (const provider of authRequestProviders) {
				let effectiveUpstream = "";

				if (
					host.npmplus_auth_request === provider ||
					(provider === "authentik" && host.npmplus_auth_request === "authentik-send-basic-auth")
				) {
					effectiveUpstream = host.npmplus_auth_request_upstream;
				} else {
					for (const location of originalLocations) {
						if (
							location.npmplus_enabled !== false &&
							(location.npmplus_auth_request === provider ||
								(provider === "authentik" &&
									location.npmplus_auth_request === "authentik-send-basic-auth")) &&
							location.npmplus_auth_request_upstream
						) {
							effectiveUpstream = location.npmplus_auth_request_upstream;
							break;
						}
					}
				}

				host[`auth_request_${provider}_upstream_resolved`] = effectiveUpstream;
			}
		}

		const config_text = await utils.renderEngine.renderFile(`${host_type}.conf`, host);

		await writeFile(
			filename,
			utils.reindent(config_text).replace(rawPlaceholderPattern, (_, index) => raws[index].trimEnd()),
			{ encoding: "utf8" },
		);
		logger.debug("Wrote config:", filename);

		return true;
	},

	/**
	 * @param   {String}  host_type
	 * @param   {Object}  [host]
	 * @returns {Promise}
	 */
	deleteConfig: async (host_type, host) => {
		const config_file = internalNginx.getConfigName(host_type, host?.id ?? 0);

		await rm(config_file, { force: true });
		await rm(`${config_file}.err`, { force: true });
	},

	/**
	 * @param   {String}  host_type
	 * @param   {Object}  [host]
	 * @returns {Promise}
	 */
	renameConfigAsError: async (host_type, host) => {
		const config_file = internalNginx.getConfigName(host_type, host?.id ?? 0);

		try {
			await rename(config_file, `${config_file}.err`);
		} catch (err) {
			if (err.code !== "ENOENT") throw err;
		}
	},
};

export default internalNginx;
