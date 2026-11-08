import { migrate as logger } from "../logger.js";

const migrateName = "not_null_user_permission_meta";

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

	await knex("user_permission").update({ meta: "{}" });

	await knex.schema.alterTable("user_permission", (table) => {
		table.json("meta").notNull().defaultTo({}).alter();
	});

	logger.info(`[${migrateName}] user_permission Table altered`);
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
