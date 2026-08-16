import { migrate as logger } from "../logger.js";

const migrateName = "redirect_auto_scheme";

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

	await knex.schema.table("redirection_host", async (table) => {
		// change the column default from $scheme to auto
		await table.string("forward_scheme").notNull().defaultTo("auto").alter();
		await knex("redirection_host").where("forward_scheme", "$scheme").update({ forward_scheme: "auto" });
	});

	logger.info(`[${migrateName}] redirection_host Table altered`);
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
