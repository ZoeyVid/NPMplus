import fs from "node:fs";
import https from "node:https";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ProxyAgent } from "proxy-agent";
import errs from "../lib/error.js";
import utils from "../lib/utils.js";
import { ipRanges as logger } from "../logger.js";
import internalNginx from "./nginx.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CLOUDFARE_V4_URL = "https://www.cloudflare.com/ips-v4";
const CLOUDFARE_V6_URL = "https://www.cloudflare.com/ips-v6";

const regIpV4 = /^(\d+\.?){4}\/\d+/;
const regIpV6 = /^(([\\da-fA-F]+)?:)+\/\\d+/;

const internalIpRanges = {
	interval_timeout: 1000 * 60 * 60 * 6 * Number.parseInt(process.env.IPRT, 10),
	interval: null,
	interval_processing: false,
	iteration_count: 0,

	initTimer: () => {
		logger.info("IP Ranges Renewal Timer initialized");
		internalIpRanges.interval = setInterval(internalIpRanges.fetch, internalIpRanges.interval_timeout);
	},

	fetchUrl: (url) => {
		const agent = new ProxyAgent();
		return new Promise((resolve, reject) => {
			logger.info(`Fetching ${url}`);
			return https
				.get(url, { agent }, (res) => {
					res.setEncoding("utf8");
					let raw_data = "";
					res.on("data", (chunk) => {
						raw_data += chunk;
					});

					res.on("end", () => {
						resolve(raw_data);
					});
				})
				.on("error", (err) => {
					reject(err);
				});
		});
	},

	/**
	 * Triggered at startup and then later by a timer, this will fetch the ip ranges from services and apply them to nginx.
	 */
	fetch: async () => {
		if (!internalIpRanges.interval_processing) {
			internalIpRanges.interval_processing = true;
			logger.info("Fetching IP Ranges from online services...");

			let ip_ranges = [];

			try {
				const cloudflare_v4_data = await internalIpRanges.fetchUrl(CLOUDFARE_V4_URL);
				const items_v4 = cloudflare_v4_data.split("\n").filter((line) => regIpV4.test(line));
				ip_ranges = [...ip_ranges, ...items_v4];

				const cloudflare_v6_data = await internalIpRanges.fetchUrl(CLOUDFARE_V6_URL);
				const items_v6 = cloudflare_v6_data.split("\n").filter((line) => regIpV6.test(line));
				ip_ranges = [...ip_ranges, ...items_v6];

				const clean_ip_ranges = ip_ranges.filter((range) => !!range);

				await internalIpRanges.generateConfig(clean_ip_ranges);

				if (internalIpRanges.iteration_count) {
					// Reload nginx
					await internalNginx.reload();
				}

				internalIpRanges.iteration_count++;
			} catch (err) {
				logger.fatal(err.message);
			} finally {
				internalIpRanges.interval_processing = false;
			}
		}
	},

	/**
	 * @param   {Array}  ip_ranges
	 * @returns {Promise}
	 */
	generateConfig: async (ip_ranges) => {
		const renderEngine = utils.getRenderEngine();
		const filename = "/data/nginx/ip_ranges.conf";

		let template = null;
		try {
			template = await fs.promises.readFile(`${__dirname}/../templates/ip_ranges.conf`, { encoding: "utf8" });
		} catch (err) {
			throw new errs.ConfigurationError(err.message);
		}

		try {
			const config_text = await renderEngine.parseAndRender(template, { ip_ranges: ip_ranges });
			await fs.promises.writeFile(filename, config_text, { encoding: "utf8" });
			return true;
		} catch (err) {
			logger.warn(`Could not write ${filename}: ${err.message}`);
			throw new errs.ConfigurationError(err.message);
		}
	},
};

export default internalIpRanges;
