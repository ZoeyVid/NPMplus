import { migrate as logger } from "../logger.js";

const migrateName = "unique_constraints";

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

	await knex("auth")
		.whereNotIn("id", knex.select("id").from(knex("auth").min("id as id").groupBy(["user_id", "type"]).as("keep")))
		.delete();

	logger.info(`[${migrateName}] Duplicates removed`);

	await knex.schema.alterTable("auth", (table) => {
		table.unique(["user_id", "type"]);
	});

	logger.info(`[${migrateName}] auth Table altered`);
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
