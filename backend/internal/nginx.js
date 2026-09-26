import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { domainToASCII } from "node:url";
import { Client, fetch } from "undici";
import errs from "../lib/error.js";
import utils from "../lib/utils.js";
import { nginx as logger } from "../logger.js";
import internalProxyHostAccessList from "./proxy-host-access-list.js";

const controlApi = new Client("http://localhost", { connect: { socketPath: "/run/nginx-control.sock" } });
const authRequestProviders = ["anubis", "tinyauth", "oauth2proxy", "voidauth", "authelia", "authentik"];

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
	configure: async (model, host_type, host, { skipReload = false } = {}) => {
		let status = {};

		// skip disabled hosts
		if (!host.enabled) return status;

		await internalProxyHostAccessList.build(host_type, host);
		await internalNginx.deleteConfig(host_type, host);
		await internalNginx.generateConfig(host_type, host);

		try {
			await (skipReload ? internalNginx.test() : internalNginx.reload());
			status = { npmplus_nginx_online: true, npmplus_nginx_err: "" };

			await model.query().where("id", host.id).patch(status);
		} catch (err) {
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
		if (process.env.ACME_OCSP_STAPLING === "true") {
			try {
				await utils.execFile("certbot-ocsp-fetcher.sh", [
					"-c",
					"/data/tls/certbot/live",
					"-o",
					"/data/tls/certbot/live",
					"--no-reload-webserver",
					"--quiet",
				]);
			} catch {}
		}

		if (process.env.CUSTOM_OCSP_STAPLING === "true") {
			try {
				await utils.execFile("certbot-ocsp-fetcher.sh", [
					"-c",
					"/data/tls/custom",
					"-o",
					"/data/tls/custom",
					"--no-reload-webserver",
					"--quiet",
				]);
			} catch {}
		}

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
			return "/usr/local/nginx/conf/conf.d/default.conf";
		}
		return `/data/nginx/${host_type}/${host_id}.conf`;
	},

	/**
	 * Generates custom locations
	 * @param   {Object}  host
	 * @returns {Promise}
	 */
	renderLocations: async (host) => {
		const template = await readFile(`${import.meta.dirname}/../templates/_proxy_host_custom_location.conf`, {
			encoding: "utf8",
		});

		const renderEngine = utils.getRenderEngine();
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
			renderedLocations += await renderEngine.parseAndRender(template, location);
		}

		return renderedLocations;
	},

	/**
	 * Generates upstream blocks for main host and custom locations
	 * @param   {Object}  host
	 * @returns {Promise}
	 */
	renderUpstreams: async (host) => {
		const template = await readFile(`${import.meta.dirname}/../templates/_upstream.conf`, {
			encoding: "utf8",
		});

		const renderEngine = utils.getRenderEngine();
		let renderedUpstreams = "";

		if (NETWORK_PROXY_SCHEMES.includes(host.forward_scheme)) {
			const firstServer = host.npmplus_upstream_servers?.[0];
			if (firstServer?.host.startsWith("cu_")) {
				host.forward_upstream_name = firstServer.host;
			} else {
				host.forward_upstream_name = `upstream_${host.id}`;
				renderedUpstreams += await renderEngine.parseAndRender(template, host);
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
				renderedUpstreams += await renderEngine.parseAndRender(template, location);
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

		const renderEngine = utils.getRenderEngine();

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
			host.server_names = host.domain_names.map((domain_name) => domainToASCII(domain_name) || domain_name);
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
					(host.npmplus_auth_request === provider ||
						(provider === "authentik" && host.npmplus_auth_request === "authentik-send-basic-auth")) &&
					host.npmplus_auth_request_upstream
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

		const config_text = await renderEngine.parseAndRender(
			await readFile(`${import.meta.dirname}/../templates/${host_type}.conf`, { encoding: "utf8" }),
			host,
		);

		await writeFile(filename, config_text, { encoding: "utf8" });
		logger.debug("Wrote config:", filename);

		if (process.env.DISABLE_NGINX_BEAUTIFIER === "false") {
			try {
				await utils.execFile("nginxbeautifier", ["-s", "2", filename]);
			} catch {
				// do nothing
			}
		}

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

		await rename(config_file, `${config_file}.err`);
	},
};

export default internalNginx;
