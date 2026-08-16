import { migrate as logger } from "../logger.js";

const migrateName = "access_list_client";

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

	await knex.schema.createTable("access_list_client", (table) => {
		table.increments().primary();
		table.dateTime("created_on").notNull();
		table.dateTime("modified_on").notNull();
		table.integer("access_list_id").notNull().unsigned();
		table.string("address").notNull();
		table.string("directive").notNull();
		table.json("meta").notNull();
	});

	logger.info(`[${migrateName}] access_list_client Table created`);

	await knex.schema.table("access_list", (access_list) => {
		access_list.integer("satify_any").notNull().defaultTo(0);
	});

	logger.info(`[${migrateName}] access_list Table altered`);
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
