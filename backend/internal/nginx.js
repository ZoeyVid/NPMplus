import fs from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import _ from "lodash";
import punycode from "punycode.js";
import errs from "../lib/error.js";
import utils from "../lib/utils.js";
import { debug, nginx as logger } from "../logger.js";

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
	configure: async (model, host_type, host) => {
		let combined_meta = {};

		await internalNginx.test();
		await internalNginx.deleteConfig(host_type, host);
		await internalNginx.reload();
		await internalNginx.generateConfig(host_type, host);

		try {
			// Test nginx again and update meta with result
			await internalNginx.test();
			
			// nginx is ok
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

		await internalNginx.reload();
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
		const promises = [];

		if (process.env.ACME_OCSP_STAPLING === "true") {
			promises.push(
				utils
					.execFile("certbot-ocsp-fetcher.sh", [
						"-c",
						"/data/tls/certbot/live",
						"-o",
						"/data/tls/certbot/live",
						"--no-reload-webserver",
						"--quiet",
					])
					.catch(() => {}),
			);
		}

		if (process.env.CUSTOM_OCSP_STAPLING === "true") {
			promises.push(
				utils
					.execFile("certbot-ocsp-fetcher.sh", [
						"-c",
						"/data/tls/custom",
						"-o",
						"/data/tls/custom",
						"--no-reload-webserver",
						"--quiet",
					])
					.catch(() => {}),
			);
		}

		await Promise.all(promises);
		
		try {
			await internalNginx.test();
			await utils.execFile("nginx", ["-s", "reload"]);
		} catch (err) {
			// ignore reload errors if test passed? No, if test failed, we shouldn't reload.
			// The original code was: test().then(() => execFile(...))
			throw err;
		}
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
			template = await fs.promises.readFile(`${__dirname}/../templates/_proxy_host_custom_location.conf`, {
				encoding: "utf8",
			});
		} catch (err) {
			throw new errs.ConfigurationError(err.message);
		}

		const renderEngine = utils.getRenderEngine();
		let renderedLocations = "";

		for (let i = 0; i < host.locations.length; i++) {
			const locationCopy = Object.assign(
				{},
				{ access_list_id: host.access_list_id },
				{ certificate_id: host.certificate_id },
				{ ssl_forced: host.ssl_forced },
				{ caching_enabled: host.caching_enabled },
				{ block_exploits: host.block_exploits },
				{ allow_websocket_upgrade: host.allow_websocket_upgrade },
				{ http2_support: host.http2_support },
				{ hsts_enabled: host.hsts_enabled },
				{ hsts_subdomains: host.hsts_subdomains },
				{ access_list: host.access_list },
				{ certificate: host.certificate },
				host.locations[i],
			);

			if (
				locationCopy.forward_host.indexOf("/") > -1 &&
				!locationCopy.forward_host.startsWith("/") &&
				!locationCopy.forward_host.startsWith("unix")
			) {
				const split = locationCopy.forward_host.split("/");

				locationCopy.forward_host = split.shift();
				locationCopy.forward_path = `/${split.join("/")}`;
			}
			locationCopy.env = process.env;

			renderedLocations += await renderEngine.parseAndRender(template, locationCopy);
		}
		return renderedLocations;
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
			template = await fs.promises.readFile(`${__dirname}/../templates/${nice_host_type}.conf`, { encoding: "utf8" });
		} catch (err) {
			throw new errs.ConfigurationError(err.message);
		}

		let origLocations;

		// Manipulate the data a bit before sending it to the template
		if (nice_host_type !== "default") {
			host.use_default_location = true;
			if (typeof host.advanced_config !== "undefined" && host.advanced_config) {
				host.use_default_location = !internalNginx.advancedConfigHasDefaultLocation(host.advanced_config);
			}
		}

		// For redirection hosts, if the scheme is not http or https, set it to $scheme
		if (
			nice_host_type === "redirection_host" &&
			["http", "https"].indexOf(host.forward_scheme.toLowerCase()) === -1
		) {
			host.forward_scheme = "$scheme";
		}

		if (host.locations) {
			origLocations = [].concat(host.locations);
			const renderedLocations = await internalNginx.renderLocations(host);
			host.locations = renderedLocations;

			// Allow someone who is using / custom location path to use it, and skip the default / location
			_.map(host.locations, (location) => {
				if (location.path === "/") {
					host.use_default_location = false;
				}
			});
		}

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

		if (host.domain_names) {
			host.server_names = host.domain_names.map((domain_name) => punycode.toASCII(domain_name));
		}

		host.env = process.env;

		try {
			const config_text = await renderEngine.parseAndRender(template, host);
			await fs.promises.writeFile(filename, config_text, { encoding: "utf8" });
			debug(logger, "Wrote config:", filename);

			// Restore locations array
			host.locations = origLocations;
		} catch (err) {
			debug(logger, `Could not write ${filename}:`, err.message);
			throw new errs.ConfigurationError(err.message);
		}

		if (process.env.DISABLE_NGINX_BEAUTIFIER === "false") {
			try {
				await utils.execFile("nginxbeautifier", ["-s", "4", filename]);
			} catch {
				// ignore beautifier errors
			}
		}
		
		return true;
	},

	/**
	 * A simple wrapper around unlinkSync that writes to the logger
	 *
	 * @param   {String}  filename
	 */
	deleteFile: async (filename) => {
		try {
			await fs.promises.access(filename);
		} catch {
			return; // file doesn't exist
		}
		
		try {
			debug(logger, `Deleting file: ${filename}`);
			await fs.promises.unlink(filename);
		} catch (err) {
			debug(logger, "Could not delete file:", JSON.stringify(err, null, 2));
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

		await internalNginx.deleteFile(config_file);
		await internalNginx.deleteFile(`${config_file}.err`);
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

		await fs.promises.rename(config_file, `${config_file}.err`);
	},

	/**
	 * @param   {String}  hostType
	 * @param   {Array}   hosts
	 * @returns {Promise}
	 */
	bulkGenerateConfigs: async (model, hostType, hosts) => {
		const promises = [];
		hosts.map((host) => {
			promises.push(internalNginx.configure(model, hostType, host));
			return true;
		});

		await Promise.all(promises);
	},

	/**
	 * @param   {string}  config
	 * @returns {boolean}
	 */
	advancedConfigHasDefaultLocation: (cfg) => !!cfg.match(/^(?:.*;)?\s*?location\s*?\/\s*?{/im),
};

export default internalNginx;