import { migrate as logger } from "../logger.js";

const migrateName = "lowercase_emails";

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

	for (const { id, email } of await knex("user").select("id", "email")) {
		const normalized = email.toLowerCase().trim();
		if (normalized !== email) await knex("user").where("id", id).update({ email: normalized });
	}

	logger.info(`[${migrateName}] emails normalized`);
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
