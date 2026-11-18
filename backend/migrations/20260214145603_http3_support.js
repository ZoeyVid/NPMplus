import { migrate as logger } from "../logger.js";

const migrateName = "npmplus_http3_support";

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

	for (const tableName of ["proxy_host", "redirection_host", "dead_host"]) {
		await knex.schema.table(tableName, (table) => {
			table.integer("npmplus_http3_support").notNull().unsigned().defaultTo(0);
		});
		logger.info(`[${migrateName}] ${tableName} Table altered`);
	}
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
