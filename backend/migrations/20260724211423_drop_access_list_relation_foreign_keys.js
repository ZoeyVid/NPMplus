import { migrate as logger } from "../logger.js";

const migrateName = "drop_access_list_relation_foreign_keys";

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

	await knex.schema.alterTable("npmplus_proxy_host_access_list", (table) => {
		table.dropForeign("proxy_host_id");
		table.dropForeign("access_list_id");
	});

	logger.info(`[${migrateName}] npmplus_proxy_host_access_list Table altered`);
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
