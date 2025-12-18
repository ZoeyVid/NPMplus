import dnsPlugins from "../certbot/dns-plugins.json" with { type: "json" };
import { certbot as logger } from "../logger.js";
import errs from "./error.js";
import utils from "./utils.js";

/**
 * Installs a certbot plugin given the key for the object from
 * ../certbot/dns-plugins.json
 *
 * @param   {string}  pluginKey
 * @returns {Promise<Object>}
 */
const installPlugin = async (pluginKey) => {
	if (typeof dnsPlugins[pluginKey] === "undefined") {
		throw new errs.ItemNotFoundError(pluginKey);
	}

	const plugin = dnsPlugins[pluginKey];
	logger.start(`Installing ${pluginKey}...`);

	try {
		const result = await utils.execFile("pip", ["install", "--upgrade", "--no-cache-dir", plugin.package_name]);
		logger.complete(`Installed ${pluginKey}`);
		return result;
	} catch (err) {
		throw err;
	}
};

/**
 * @param {Array<string>} pluginKeys
 * @returns {Promise<void>}
 */
const installPlugins = async (pluginKeys) => {
	if (pluginKeys.length === 0) {
		return;
	}

	let hasErrors = false;

	for (const pluginKey of pluginKeys) {
		try {
			await installPlugin(pluginKey);
		} catch (err) {
			logger.error(err.message);
			hasErrors = true;
		}
	}

	if (hasErrors) {
		throw new errs.CommandError("Some plugins failed to install. Please check the logs above", 1);
	}
};

export { installPlugins, installPlugin };
