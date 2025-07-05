#!/usr/bin/env node

const schema = require('./schema');
const logger = require('./logger').global;

async function appStart() {
	const migrate = require('./migrate');
	const setup = require('./setup');
	const app = require('./app');
	const internalNginx = require('./internal/nginx');
	const internalCertificate = require('./internal/certificate');
	const internalIpRanges = require('./internal/ip_ranges');
	const internalDomainLog = require('./internal/domain-log');

	return migrate
		.latest()
		.then((result) => {
			logger.info('Migration completed:', result);
			return setup;
		})
		.then((setupFunction) => {
			return setupFunction();
		})
		.then(schema.getCompiledSchema)
		.then(async () => {
			// Verify all required tables exist before proceeding
			try {
				const db = require('./db');
				await db.raw('SELECT 1 FROM certificate LIMIT 1').catch(() => {
					// Table might be empty, that's fine
				});
				await db.raw('SELECT 1 FROM acme_server LIMIT 1').catch(() => {
					// Table might be empty, that's fine
				});
				logger.info('Database tables verified successfully');
			} catch (err) {
				logger.error('Required database tables not available:', err.message);
				throw new Error('Database not ready: ' + err.message);
			}
		})
		.then(internalIpRanges.fetch)
		.then(async () => {
			// Initialize log directories for all existing proxy hosts
			try {
				await internalDomainLog.initializeAllLogDirectories();
				logger.info('Log directories initialized for all proxy hosts');
			} catch (err) {
				logger.warn('Failed to initialize log directories:', err.message);
			}
		})
		.then(() => {
			internalNginx.reload();
			internalCertificate.initTimer();
			internalIpRanges.initTimer();

			const server = app.listen('/run/npmplus.sock', () => {
				logger.info('Backend PID ' + process.pid + ' listening on unix socket');

				process.on('SIGTERM', () => {
					logger.info('PID ' + process.pid + ' received SIGTERM');
					server.close(() => {
						logger.info('Stopping.');
						process.exit(0);
					});
				});
			});
		})
		.catch((err) => {
			logger.error(err.message, err);
			setTimeout(appStart, 1000);
		});
}

try {
	appStart();
} catch (err) {
	logger.error(err.message, err);
	process.exit(1);
}
