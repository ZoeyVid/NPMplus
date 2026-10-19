import { remoteVersion as logger } from "../logger.js";
import pjson from "../package.json" with { type: "json" };

const internalRemoteVersion = {
	cache_timeout: 1000 * 60 * 60, // 1 hour
	retry_timeout: 1000 * 60 * 6, // 6 minutes
	last_result: null,
	next_fetch_time: 0,

	/**
	 * Fetch the latest version info, using a cached result if within the cache timeout period.
	 * @return {Promise<{current: string, latest: string, update_available: boolean}>} Version info
	 */
	get: async () => {
		try {
			if (Date.now() >= internalRemoteVersion.next_fetch_time) {
				internalRemoteVersion.next_fetch_time = Date.now() + internalRemoteVersion.retry_timeout;
				const response = await fetch("https://api.github.com/repos/ZoeyVid/NPMplus/releases/latest", {
					headers: {
						"User-Agent": `NPMplus/${pjson.version}`,
					},
					signal: AbortSignal.timeout(10000),
				});

				if (!response.ok) {
					throw new Error(`Status code: ${response.status}`);
				}

				const data = await response.json();

				internalRemoteVersion.last_result = data;
				internalRemoteVersion.next_fetch_time = Date.now() + internalRemoteVersion.cache_timeout;
			}
		} catch (error) {
			logger.error("Failed to fetch remote version:", error.message);
		}

		if (!internalRemoteVersion.last_result) {
			return {
				current: pjson.version,
				latest: "unknown",
				update_available: false,
			};
		}

		const latestVersion = internalRemoteVersion.last_result?.tag_name || "unknown";
		const currentVersion = pjson.version;
		return {
			current: currentVersion,
			latest: latestVersion,
			update_available: currentVersion < latestVersion && currentVersion.length >= 13,
		};
	},
};

export default internalRemoteVersion;
