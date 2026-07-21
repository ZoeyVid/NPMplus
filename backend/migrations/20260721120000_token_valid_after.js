import { migrate as logger } from "../logger.js";

const migrateName = "token_valid_after";

/**
 * Migrate
 *
 * @see https://knexjs.org/guide/migrations.html#migration-api
 *
 * @param   {Object} knex
 * @returns {Promise}
 */
const up = (knex) => {
	logger.info(`[${migrateName}] Migrating Up...`);

	return knex.schema
		.table("user", (user) => {
			user.bigInteger("npmplus_token_valid_after").notNull().unsigned().defaultTo(0);
		})
		.then(() => {
			logger.info(`[${migrateName}] user Table altered`);
		});
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

export { up, down };
