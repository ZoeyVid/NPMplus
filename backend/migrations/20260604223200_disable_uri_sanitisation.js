import { migrate as logger } from "../logger.js";

const migrateName = "disable_uri_sanitisation";

/**
 * Migrate
 *
 * @see https://knexjs.org/guide/migrations.html#migration-api
 *
 * @param   {Object} knex
 * @returns {Promise}
 */
const up = async (knex) => {
	logger.info(`[${migrateName}] Migrating Up...`);

	await knex.schema.table("proxy_host", (proxy_host) => {
		proxy_host.integer("npmplus_disable_uri_sanitisation").notNull().unsigned().defaultTo(1);
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
