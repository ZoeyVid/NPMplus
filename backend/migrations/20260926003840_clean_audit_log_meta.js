import { jsonReplacer } from "../lib/helpers.js";
import { migrate as logger } from "../logger.js";

const migrateName = "clean_audit_log_meta";

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

	for (const row of await knex("audit_log").select("id", "meta")) {
		const meta = typeof row.meta === "string" ? JSON.parse(row.meta) : row.meta;
		const cleanedMeta = JSON.stringify(meta, jsonReplacer);
		if (cleanedMeta !== JSON.stringify(meta))
			await knex("audit_log").where("id", row.id).update({ meta: cleanedMeta });
	}

	logger.info(`[${migrateName}] audit_log Table altered`);
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
