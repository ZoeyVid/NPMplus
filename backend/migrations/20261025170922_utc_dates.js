import { isMysql, isPostgres } from "../lib/config.js";
import { migrate as logger } from "../logger.js";

const migrateName = "utc_dates";

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

	if (isPostgres()) {
		logger.info(`[${migrateName}] timestamptz columns are already stored as UTC`);
		return;
	}

	for (const [tableName, columns] of [
		["auth", ["created_on", "modified_on"]],
		["user", ["created_on", "modified_on"]],
		["user_permission", ["created_on", "modified_on"]],
		["proxy_host", ["created_on", "modified_on"]],
		["redirection_host", ["created_on", "modified_on"]],
		["dead_host", ["created_on", "modified_on"]],
		["stream", ["created_on", "modified_on"]],
		["access_list", ["created_on", "modified_on"]],
		["certificate", ["created_on", "modified_on", "expires_on"]],
		["access_list_auth", ["created_on", "modified_on"]],
		["access_list_client", ["created_on", "modified_on"]],
		["audit_log", ["created_on", "modified_on"]],
	]) {
		for (const column of columns) {
			await knex(tableName).update(
				column,
				isMysql()
					? knex.raw("CONVERT_TZ(??, @@session.time_zone, '+00:00')", column)
					: knex.raw("datetime(??, 'utc')", column),
			);
		}
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
