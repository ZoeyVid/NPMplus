import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { domainToASCII, fileURLToPath } from "node:url";
import _ from "lodash";
import errs from "../lib/error.js";
import utils from "../lib/utils.js";
import { debug, nginx as logger } from "../logger.js";
import internalProxyHostAccessList from "./proxy-host-access-list.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const internalNginx = {
	/**
	 * This will:
	 * - test the nginx config first to make sure it's OK
	 * - create / recreate the config for the host
	 * - test again
	 * - IF OK:  update the meta with online status
	 * - IF BAD: update the meta with offline status and rename the config
	 * - then reload nginx
	 *
	 * @param   {Object|String}  model
	 * @param   {String}         host_type
	 * @param   {Object}         host
	 * @returns {Promise}
	 */
	configure: async (model, host_type, host, { skipReload = false } = {}) => {
		let combined_meta = {};

		await internalProxyHostAccessList.build(host_type, host);
		await internalNginx.deleteConfig(host_type, host);
		await internalNginx.generateConfig(host_type, host);

		try {
			await internalNginx.test();
			combined_meta = _.assign({}, host.meta, {
				nginx_online: true,
				nginx_err: null,
			});

			await model.query().where("id", host.id).patch({
				meta: combined_meta,
			});
		} catch (err) {
			logger.error(err.message);

			// config is bad, update meta and rename config
			combined_meta = _.assign({}, host.meta, {
				nginx_online: false,
				nginx_err: err.message,
			});

			await model.query().where("id", host.id).patch({
				meta: combined_meta,
			});

			await internalNginx.renameConfigAsError(host_type, host);
		}

		if (!skipReload) {
			await internalNginx.reload();
		}
		return combined_meta;
	},

	/**
	 * @returns {Promise}
	 */
	test: async () => {
		return utils.execFile("nginx", ["-tq"]);
	},

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

		await internalNginx.test();
		return utils.execFile("nginx", ["-s", "reload"]);
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
		return `/data/nginx/${internalNginx.getFileFriendlyHostType(host_type)}/${host_id}.conf`;
	},

	/**
	 * Generates custom locations
	 * @param   {Object}  host
	 * @returns {Promise}
	 */
	renderLocations: async (host) => {
		let template;

		try {
			template = await readFile(`${__dirname}/../templates/_proxy_host_custom_location.conf`, {
				encoding: "utf8",
			});
		} catch (err) {
			throw new errs.ConfigurationError(err.message);
		}

		const renderEngine = utils.getRenderEngine();
		let renderedLocations = "";

		for (const [idx, location] of (host.locations || []).entries()) {
			if (location.npmplus_enabled === false) {
				continue;
			}

			if (
				location.forward_host &&
				location.forward_host.indexOf("/") > -1 &&
				!location.forward_host.startsWith("/") &&
				!location.forward_host.startsWith("unix")
			) {
				const split = location.forward_host.split("/");

				location.forward_host = split.shift();
				location.forward_path = `/${split.join("/")}`;
			}

			if (location.npmplus_spoof_host_header === true) {
				location.spoofed_host = location.forward_host;
				if (location.forward_port !== null && location.forward_port !== undefined) {
					if (location.forward_scheme === "http" || location.forward_scheme === "grpc") {
						if (location.forward_port !== 80) {
							location.spoofed_host = `${location.forward_host}:${location.forward_port}`;
						}
					} else if (location.forward_scheme === "https" || location.forward_scheme === "grpcs") {
						if (location.forward_port !== 443) {
							location.spoofed_host = `${location.forward_host}:${location.forward_port}`;
						}
					}
				}
			}

			if (location.forward_host?.startsWith("cu_")) {
				location.forward_upstream_name = location.forward_host;
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
		let template;

		try {
			template = await readFile(`${__dirname}/../templates/_upstream.conf`, {
				encoding: "utf8",
			});
		} catch (err) {
			throw new errs.ConfigurationError(err.message);
		}

		const renderEngine = utils.getRenderEngine();
		let renderedUpstreams = "";

		if (["http", "https", "grpc", "grpcs"].includes(host.forward_scheme)) {
			if (
				host.forward_host &&
				host.forward_host.indexOf("/") > -1 &&
				!host.forward_host.startsWith("/") &&
				!host.forward_host.startsWith("unix")
			) {
				const split = host.forward_host.split("/");
				host.forward_host = split.shift();
				host.forward_path = `/${split.join("/")}`;
			}

			if (host.forward_host?.startsWith("cu_")) {
				host.forward_upstream_name = host.forward_host;
			} else {
				host.forward_upstream_name = `upstream_${host.id}`;
				renderedUpstreams += await renderEngine.parseAndRender(template, host);
			}
		}

		for (const [idx, location] of (host.locations || []).entries()) {
			if (location.npmplus_enabled === false) {
				continue;
			}

			if (!["http", "https", "grpc", "grpcs"].includes(location.forward_scheme)) {
				continue;
			}

			if (
				location.forward_host &&
				location.forward_host.indexOf("/") > -1 &&
				!location.forward_host.startsWith("/") &&
				!location.forward_host.startsWith("unix")
			) {
				const split = location.forward_host.split("/");
				location.forward_host = split.shift();
				location.forward_path = `/${split.join("/")}`;
			}

			if (location.forward_host?.startsWith("cu_")) {
				location.forward_upstream_name = location.forward_host;
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
		const host = JSON.parse(JSON.stringify(host_row));
		const nice_host_type = internalNginx.getFileFriendlyHostType(host_type);

		const renderEngine = utils.getRenderEngine();

		let template = null;
		const filename = internalNginx.getConfigName(nice_host_type, host.id);

		try {
			template = await readFile(`${__dirname}/../templates/${nice_host_type}.conf`, { encoding: "utf8" });
		} catch (err) {
			throw new errs.ConfigurationError(err.message);
		}

		host.env = process.env;

		if (
			host.forward_host &&
			host.forward_host.indexOf("/") > -1 &&
			!host.forward_host.startsWith("/") &&
			!host.forward_host.startsWith("unix")
		) {
			const split = host.forward_host.split("/");
			host.forward_host = split.shift();
			host.forward_path = `/${split.join("/")}`;
		}

		if (host.npmplus_spoof_host_header === true) {
			host.spoofed_host = host.forward_host;
			if (host.forward_port !== null && host.forward_port !== undefined) {
				if (host.forward_scheme === "http" || host.forward_scheme === "grpc") {
					if (host.forward_port !== 80) {
						host.spoofed_host = `${host.forward_host}:${host.forward_port}`;
					}
				} else if (host.forward_scheme === "https" || host.forward_scheme === "grpcs") {
					if (host.forward_port !== 443) {
						host.spoofed_host = `${host.forward_host}:${host.forward_port}`;
					}
				}
			}
		}

		if (host.domain_names) {
			host.server_names = host.domain_names.map((domain_name) => domainToASCII(domain_name) || domain_name);
		}
		if (host.npmplus_access_list_type === "custom") {
			// note that there is access_lists -> an array in the correct order
			// and access_list -> an object used in the config generation
			// note the (s) in the former and lack thereof in the latter

			// must be ordered by ID as the AccessList constructed is unordered, but for generation it must be.
			// the IDs are retrieved in the correct order (specified in the UI) from the DB so they are used for the ordering
			const hostAccessLists = Array.isArray(host.access_lists) ? host.access_lists : [];
			host.access_lists = internalProxyHostAccessList.orderAccessListsByIds(
				hostAccessLists,
				host.npmplus_access_list_ids,
			);
			host.access_list = internalProxyHostAccessList.buildAclFile(host.access_lists);
		}
		const hostHtpasswdFileName = internalProxyHostAccessList.getHostFileName(host);
		if (hostHtpasswdFileName.length > 0) {
			host.filename = hostHtpasswdFileName;
		}

		host.upstreams = await internalNginx.renderUpstreams(host);

		if (host.locations) {
			_.map(host.locations, (location) => {
				if (location.npmplus_access_list_type === "global") {
					location.access_list = host.access_list;
				} else if (location.npmplus_access_list_type === "custom") {
					// note that there is access_lists -> an array in the correct order
					// and access_list -> an object used in the config generation
					// note the (s) in the former and lack thereof in the latter

					// must be ordered by ID as the AccessList constructed is unordered, but for generation it must be.
					// the IDs are retrieved in the correct order (specified in the UI) from the DB so they are used for the ordering
					location.access_lists = internalProxyHostAccessList.orderAccessListsByIds(
						location.access_lists || [],
						location.npmplus_access_list_ids,
					);
					location.access_list = internalProxyHostAccessList.buildAclFile(location.access_lists);
				}

				const htpasswdFileName = internalProxyHostAccessList.getLocationFileName(host, location);
				if (htpasswdFileName.length > 0) {
					location.filename = htpasswdFileName;
				}
				if (location.npmplus_auth_request === "anubis") {
					host.create_anubis_locations = true;
				}
				if (location.npmplus_auth_request === "tinyauth") {
					host.create_tinyauth_locations = true;
				}
				if (location.npmplus_auth_request === "oauth2proxy") {
					host.create_oauth2proxy_locations = true;
				}
				if (location.npmplus_auth_request === "voidauth") {
					host.create_voidauth_locations = true;
				}
				if (location.npmplus_auth_request === "authelia") {
					host.create_authelia_locations = true;
				}
				if (
					location.npmplus_auth_request === "authentik" ||
					location.npmplus_auth_request === "authentik-send-basic-auth"
				) {
					host.create_authentik_locations = true;
				}
			});

			const originalLocations = [...host.locations];
			host.locations = await internalNginx.renderLocations(host);

			const providerEnvMap = {
				anubis: "AUTH_REQUEST_ANUBIS_UPSTREAM",
				tinyauth: "AUTH_REQUEST_TINYAUTH_UPSTREAM",
				oauth2proxy: "AUTH_REQUEST_OAUTH2PROXY_UPSTREAM",
				voidauth: "AUTH_REQUEST_VOIDAUTH_UPSTREAM",
				authelia: "AUTH_REQUEST_AUTHELIA_UPSTREAM",
				authentik: "AUTH_REQUEST_AUTHENTIK_UPSTREAM",
			};

			for (const [provider, envKey] of Object.entries(providerEnvMap)) {
				let effectiveUpstream = process.env[envKey] || "";

				if (
					(host.npmplus_auth_request === provider ||
						(provider === "authentik" && host.npmplus_auth_request === "authentik-send-basic-auth")) &&
					host.npmplus_auth_request_upstream
				) {
					effectiveUpstream = host.npmplus_auth_request_upstream;
				} else {
					for (const location of originalLocations) {
						if (
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

		try {
			const config_text = await renderEngine.parseAndRender(template, host);

			await writeFile(filename, config_text, { encoding: "utf8" });
			debug(logger, "Wrote config:", filename);

			if (process.env.DISABLE_NGINX_BEAUTIFIER === "false") {
				await utils.execFile("nginxbeautifier", ["-s", "2", filename]).catch(() => {});
			}

			return true;
		} catch (err) {
			debug(logger, `Could not write ${filename}:`, err.message);
			throw new errs.ConfigurationError(err.message);
		}
	},

	/**
	 *
	 * @param   {String} host_type
	 * @returns String
	 */
	getFileFriendlyHostType: (host_type) => {
		return host_type.replace(/-/g, "_");
	},

	/**
	 * @param   {String}  host_type
	 * @param   {Object}  [host]
	 * @returns {Promise}
	 */
	deleteConfig: async (host_type, host) => {
		const config_file = internalNginx.getConfigName(
			internalNginx.getFileFriendlyHostType(host_type),
			typeof host === "undefined" ? 0 : host.id,
		);

		const filesToDelete = [config_file, `${config_file}.err`];

		for (const filename of filesToDelete) {
			try {
				debug(logger, `Deleting file: ${filename}`);
				await rm(filename, { force: true });
			} catch (err) {
				debug(logger, "Could not delete file:", JSON.stringify(err, null, 2));
			}
		}
	},

	/**
	 * @param   {String}  host_type
	 * @param   {Object}  [host]
	 * @returns {Promise}
	 */
	renameConfigAsError: async (host_type, host) => {
		const config_file = internalNginx.getConfigName(
			internalNginx.getFileFriendlyHostType(host_type),
			typeof host === "undefined" ? 0 : host.id,
		);

		try {
			await rename(config_file, `${config_file}.err`);
		} catch {}
	},

	/**
	 * @param   {String}  hostType
	 * @param   {Array}   hosts
	 * @returns {Promise}
	 */
	bulkGenerateConfigs: async (model, hostType, hosts, { skipReload = false } = {}) => {
		const results = [];

		for (const host of hosts) {
			const result = await internalNginx.configure(model, hostType, host, { skipReload });
			results.push(result);
		}

		return results;
	},
};

export default internalNginx;
