import { writeFile } from "node:fs/promises";
import dnsPlugins from "./certbot/dns-plugins.json" with { type: "json" };
import internalHost from "./internal/host.js";
import internalNginx from "./internal/nginx.js";
import internalProxyHost from "./internal/proxy-host.js";
import internalUser from "./internal/user.js";
import Access from "./lib/access.js";
import { installPlugins } from "./lib/certbot.js";
import { setup as logger } from "./logger.js";
import certificateModel from "./models/certificate.js";
import deadModel from "./models/dead_host.js";
import proxyModel from "./models/proxy_host.js";
import redirectionModel from "./models/redirection_host.js";
import settingModel from "./models/setting.js";
import streamModel from "./models/stream.js";
import userModel from "./models/user.js";

/**
 * Creates a default admin users if one doesn't already exist in the database
 *
 * @returns {Promise}
 */
const setupDefaultUser = async () => {
	const initialAdminEmail = process.env.INITIAL_ADMIN_EMAIL?.trim();
	const initialAdminPassword = process.env.INITIAL_ADMIN_PASSWORD;

	// This will only create a new user when there are no active users in the database
	// and the INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD environment variables are set.
	// Otherwise, users should be shown the setup wizard in the frontend.
	// I'm keeping this legacy behavior in case some people are automating deployments.

	if (!initialAdminEmail || !initialAdminPassword) {
		return;
	}

	const userIsetup = await isSetup();
	if (!userIsetup) {
		// Create a new user and set password
		logger.info(`Creating initial user: ${initialAdminEmail}`);

		const access = new Access(null);
		await access.load(true);

		await internalUser.create(access, {
			email: initialAdminEmail,
			name: "Administrator",
			roles: ["admin"],
			auth: {
				type: "password",
				secret: initialAdminPassword,
			},
		});
		logger.info(`Initial admin user creation completed: ${initialAdminEmail}`);
	}
};

/**
 * Creates default settings if they don't already exist in the database
 *
 * @returns {Promise}
 */
const setupDefaultSettings = async () => {
	if (!(await settingModel.query().select("id").where({ id: "default-site" }).first())?.id) {
		await settingModel.query().insert({
			id: "default-site",
			name: "Default Site",
			description: "What to show when Nginx is hit with an unknown Host",
			value: process.env.INITIAL_DEFAULT_PAGE || "congratulations",
			meta: {},
		});
		logger.info("Default settings added");
	}

	await settingModel.query().deleteById("oidc-config");

	await internalNginx.generateConfig("default", await settingModel.query().where({ id: "default-site" }).first());
};

/**
 * Installs all Certbot plugins which are required for an installed certificate
 *
 * @returns {Promise}
 */
const setupCertbotPlugins = async () => {
	const plugins = [];

	for (const certificate of await certificateModel.query().where("provider", "letsencrypt")) {
		if (certificate.npmplus_dns_challenge) {
			if (dnsPlugins[certificate.npmplus_dns_provider]?.package_name === undefined) {
				logger.warn(
					`Unknown DNS provider '${certificate.npmplus_dns_provider}' for Cert #${certificate.id}, skipping Certbot plugin installation`,
				);
			} else if (!plugins.includes(certificate.npmplus_dns_provider)) {
				plugins.push(certificate.npmplus_dns_provider);
			}

			await writeFile(
				`/tmp/certbot-credentials/credentials-${certificate.id}`,
				certificate.npmplus_dns_provider_credentials,
				{ mode: 0o600 },
			);
		}
	}

	try {
		await installPlugins(plugins);
	} catch (err) {
		logger.error(err.message);
		return;
	}

	if (plugins.length > 0) {
		logger.info(`Added Certbot plugins ${plugins.join(", ")}`);
	}
};

/**
 * regenerate all hosts if needed
 *
 * @returns {Promise}
 */
const regenerateAllHosts = async () => {
	if (process.env.REGENERATE_ALL === "true") {
		const proxyHosts = await proxyModel
			.query()
			.where("enabled", 1)
			.withGraphFetched("[access_lists.[clients,items],certificate,locations.access_lists.[clients,items]]");
		for (const host of proxyHosts) {
			await internalNginx.configure(proxyModel, "proxy_host", host, { skipReload: true });
		}

		const redirectionHosts = await redirectionModel.query().where("enabled", 1).withGraphFetched("certificate");
		for (const host of redirectionHosts) {
			await internalNginx.configure(redirectionModel, "redirection_host", host, { skipReload: true });
		}

		const deadHosts = await deadModel.query().where("enabled", 1).withGraphFetched("certificate");
		for (const host of deadHosts) {
			await internalNginx.configure(deadModel, "dead_host", host, { skipReload: true });
		}

		const streamHosts = await streamModel.query().where("enabled", 1).withGraphFetched("certificate");
		for (const host of streamHosts) {
			await internalNginx.configure(streamModel, "stream", host, { skipReload: true });
		}

		await writeFile("/data/npmplus/env.sha512sum", process.env.ENV_SHA512SUM);
		await internalNginx.reload();
	}
};

/**
 * Creates the AIO proxy host if enabled and not already present
 *
 * @returns {Promise}
 */
const setupAio = async () => {
	const domain = process.env.NC_DOMAIN;
	if (process.env.NC_AIO !== "true" || !domain) return;
	if ((await internalHost.isHostnameTaken(domain)).is_taken) return;

	const access = new Access(null);
	await access.load(true);

	try {
		await internalProxyHost.create(access, {
			domain_names: [domain],
			forward_scheme: "http",
			forward_host: "127.0.0.1",
			forward_port: 11000,
			npmplus_crowdsec_appsec: true,
			npmplus_proxy_request_buffering: true,
			npmplus_proxy_response_buffering: true,
			npmplus_upstream_compression: true,
			certificate_id: "new",
			ssl_forced: true,
			hsts_enabled: true,
			hsts_subdomains: true,
			npmplus_http3_support: true,
		});
		logger.info("AIO proxy host created");
	} catch (err) {
		logger.error(`AIO proxy host setup failed, create it manually in the NPMplus UI: ${err.message}`);
	}
};

export const isSetup = async () => {
	const row = await userModel.query().select("id").first();
	return row?.id > 0;
};

export default async () => {
	await setupDefaultUser();
	await setupDefaultSettings();
	await setupCertbotPlugins();
	await regenerateAllHosts();
	await setupAio();
};
