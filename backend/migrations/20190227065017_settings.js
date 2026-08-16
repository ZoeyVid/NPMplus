import { migrate as logger } from "../logger.js";

const migrateName = "settings";

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

	await knex.schema.createTable("setting", (table) => {
		table.string("id").notNull().primary();
		table.string("name", 100).notNull();
		table.string("description", 255).notNull();
		table.string("value", 255).notNull();
		table.json("meta").notNull();
	});

	logger.info(`[${migrateName}] setting Table created`);
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
