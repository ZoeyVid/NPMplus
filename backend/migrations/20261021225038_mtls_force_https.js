import { migrate as logger } from "../logger.js";

const migrateName = "mtls_force_https";

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

	for (const tableName of ["proxy_host", "redirection_host", "dead_host"]) {
		await knex(tableName)
			.where("npmplus_mtls_certificate_id", ">", 0)
			.andWhere("npmplus_mtls_verify_client_optional", 0)
			.update({ ssl_forced: 1 });
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
