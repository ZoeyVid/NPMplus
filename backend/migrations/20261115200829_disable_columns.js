import { migrate as logger } from "../logger.js";

const migrateName = "disable_columns";

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
			table.renameColumn("npmplus_crowdsec_appsec", "npmplus_disable_crowdsec_appsec");
			table.renameColumn("npmplus_proxy_request_buffering", "npmplus_disable_proxy_request_buffering");
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
