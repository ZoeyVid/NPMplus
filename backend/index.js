#!/usr/bin/env node

import app from "./app.js";
import internalCertificate from "./internal/certificate.js";
import internalIpRanges from "./internal/ip_ranges.js";
import internalNginx from "./internal/nginx.js";
import { global as logger } from "./logger.js";
import { migrateUp } from "./migrate.js";
import { getCompiledSchema } from "./schema/index.js";
import setup from "./setup.js";

async function appStart() {
	try {
		await migrateUp();
		await setup();
		await getCompiledSchema();

		if (process.env.TRUST_CLOUDFLARE === "false") {
			logger.info("Cloudflares IPs are NOT trusted");
			await internalIpRanges.generateConfig([]);
		} else {
			logger.info("Cloudflares IPs are trusted");
			internalIpRanges.initTimer();
			await internalIpRanges.fetch();
		}
		internalCertificate.initTimer();
		await internalNginx.reload();

		const server = app.listen("/run/npmplus.sock", () => {
			logger.info(`Backend PID ${process.pid} listening on unix socket...`);

			process.on("SIGTERM", () => {
				logger.info(`PID ${process.pid} received SIGTERM`);
				server.close(() => {
					logger.info("Stopping.");
					process.exit(0);
				});
			});
		});
	} catch (err) {
		logger.error(`Startup Error: ${err.message}`, err);
		setTimeout(appStart, 1000);
	}
}

try {
	await appStart();
} catch (err) {
	logger.fatal(err);
	process.exit(1);
}
