import { migrate as logger } from "../logger.js";

const migrateName = "remove_certificate_meta_files";

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

	for (const row of await knex("certificate").select("id", "meta")) {
		const { certificate, certificate_key, intermediate_certificate, ...meta } =
			typeof row.meta === "string" ? JSON.parse(row.meta) : row.meta;
		await knex("certificate")
			.where("id", row.id)
			.update({ meta: JSON.stringify(meta) });
	}

	logger.info(`[${migrateName}] certificate Table altered`);
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
