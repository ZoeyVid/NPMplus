import { migrate as logger } from "../logger.js";

const migrateName = "location_type_without_space";

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

	for (const type of ["=", "^~", "~", "~*"]) {
		await knex("npmplus_location").where("location_type", `${type} `).update({ location_type: type });
	}

	logger.info(`[${migrateName}] npmplus_location Table updated`);
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
