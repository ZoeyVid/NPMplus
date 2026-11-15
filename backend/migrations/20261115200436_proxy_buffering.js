import { migrate as logger } from "../logger.js";

const migrateName = "proxy_buffering";

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

	for (const tableName of ["proxy_host", "npmplus_location"]) {
		await knex.schema.alterTable(tableName, (table) => {
			table.string("npmplus_proxy_response_buffering").notNull().defaultTo("on_auto").alter();
		});
		await knex(tableName)
			.where("npmplus_proxy_response_buffering", "1")
			.update({ npmplus_proxy_response_buffering: "off_auto" });
		await knex(tableName)
			.whereNot("npmplus_proxy_response_buffering", "off_auto")
			.update({ npmplus_proxy_response_buffering: "on_auto" });

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
