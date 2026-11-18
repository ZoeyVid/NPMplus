import { migrate as logger } from "../logger.js";

const migrateName = "new_proxy_buttons";

/**
 * Migrate
 *
 * @see https://knexjs.org/guide/migrations.html#migration-api
 *
 * @param   {Object}  knex
 * @returns {Promise}
 */
const up = async (knex) => {
	logger.info(`[${migrateName}] Migrating Up...`);

	await knex.schema.table("proxy_host", (proxy_host) => {
		proxy_host.integer("npmplus_proxy_request_buffering").notNull().unsigned().defaultTo(0);
		proxy_host.integer("npmplus_proxy_response_buffering").notNull().unsigned().defaultTo(0);
		proxy_host.integer("npmplus_fancyindex_upstream_compression").notNull().unsigned().defaultTo(0);
		proxy_host.integer("npmplus_noindex").notNull().unsigned().defaultTo(0);
	});

	logger.info(`[${migrateName}] proxy_host Table altered`);
};

/**
 * Undo Migrate
 *
 * @param   {Object} _knex
 * @returns {Promise}
 */
const down = (_knex) => {
	throw new Error(`[${migrateName}] You can't migrate down this one.`);
};

export { down, up };
