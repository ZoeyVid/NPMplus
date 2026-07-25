import { migrate as logger } from "../logger.js";

const migrateName = "not_null_optional_columns";

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

	await knex("proxy_host").whereNull("locations").update({ locations: "[]" });
	await knex("proxy_host").whereNull("npmplus_access_list_ids").update({ npmplus_access_list_ids: "[]" });
	await knex("stream").whereNull("forwarding_port").update({ forwarding_port: "" });
	await knex("stream").whereNull("npmplus_description").update({ npmplus_description: "" });

	await knex.schema.alterTable("proxy_host", (table) => {
		table.json("locations").notNull().defaultTo("[]").alter();
		table.json("npmplus_access_list_ids").notNull().defaultTo("[]").alter();
	});

	logger.info(`[${migrateName}] proxy_host Table altered`);

	await knex.schema.alterTable("stream", (table) => {
		table.string("forwarding_port", 12).notNull().defaultTo("").alter();
		table.string("npmplus_description", 255).notNull().defaultTo("").alter();
	});

	logger.info(`[${migrateName}] stream Table altered`);
};

/**
 * Undo Migrate
 *
 * @param   {Object} _knex
 * @returns {Promise}
 */
const down = (_knex) => {
	logger.warn(`[${migrateName}] You can't migrate down this one.`);
	return Promise.resolve(true);
};

export { down, up };
