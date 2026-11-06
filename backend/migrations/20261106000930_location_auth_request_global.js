import { migrate as logger } from "../logger.js";

const migrateName = "location_auth_request_global";

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

	await knex.schema.table("npmplus_location", (location) => {
		location.string("npmplus_auth_request").notNull().defaultTo("global").alter();
	});

	logger.info(`[${migrateName}] npmplus_location Table altered`);
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
