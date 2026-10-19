import dnsPlugins from "../certbot/dns-plugins.json" with { type: "json" };
import { certbot as logger } from "../logger.js";
import errs from "./error.js";
import utils from "./utils.js";

/**
 * Installs a cerbot plugin given the key for the object from
 * ../certbot/dns-plugins.json
 *
 * @param   {string}  pluginKey
 * @returns {Object}
 */
const installPlugin = async (pluginKey) => {
	if (dnsPlugins[pluginKey]?.package_name === undefined) {
		// throw Error(`Certbot plugin ${pluginKey} not found`);
		throw new errs.ItemNotFoundError(pluginKey);
	}

	const plugin = dnsPlugins[pluginKey];
	logger.start(`Installing ${pluginKey}...`);

	const result = await utils.execFile("pip", ["install", "--upgrade", "--no-cache-dir", plugin.package_name]);

	logger.complete(`Installed ${pluginKey}`);
	return result;
};

/**
 * @param {array} pluginKeys
 */
const installPlugins = async (pluginKeys) => {
	let failed;
	for (const pluginKey of pluginKeys) {
		try {
			await installPlugin(pluginKey);
		} catch (err) {
			logger.error(err.message);
			failed ??= err;
		}
	}
	if (failed) {
		throw new errs.CommandError("Some plugins failed to install. Please check the logs above", { cause: failed });
	}
};

export { installPlugin, installPlugins };
