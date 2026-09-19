import { migrate as logger } from "../logger.js";

const migrateName = "proxy_host_upstream";

/**
 * Adds load-balancing configuration to proxy hosts.
 *
 * @param {Object} knex
 * @returns {Promise}
 */
const up = async (knex) => {
	logger.info(`[${migrateName}] Migrating Up...`);

	await knex.schema.table("proxy_host", (proxyHost) => {
		proxyHost.json("npmplus_upstream_servers").notNull().defaultTo("[]");
		proxyHost.string("npmplus_load_balance_method").notNull().defaultTo("round_robin");
	});

	logger.info(`[${migrateName}] proxy_host Table altered`);
};

/**
 * @param {Object} knex
 * @returns {Promise}
 */
const down = async (knex) => {
	logger.info(`[${migrateName}] Migrating Down...`);

	await knex.schema.table("proxy_host", (proxyHost) => {
		proxyHost.dropColumn("npmplus_upstream_servers");
		proxyHost.dropColumn("npmplus_load_balance_method");
	});

	logger.info(`[${migrateName}] proxy_host Table altered`);
};

export { down, up };
