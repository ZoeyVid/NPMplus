import { migrate as logger } from "../logger.js";

const migrateName = "auth_factor_rows";

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

	await knex.schema.alterTable("auth", (table) => {
		table.dropUnique(["user_id", "type"]);
		table.index(["user_id", "type"]);
	});

	logger.info(`[${migrateName}] auth Table altered`);

	const rows = [];

	for (const auth of await knex("auth")
		.where("type", "password")
		.select("user_id", "meta", "created_on", "modified_on")) {
		const meta = typeof auth.meta === "string" ? JSON.parse(auth.meta) : auth.meta;
		const factors = [];

		// an unfinished enrollment is not carried over, it is started again
		if (meta.totp_enabled === true && meta.totp_secret) factors.push(["totp", meta.totp_secret]);

		for (const code of meta.backup_codes || []) factors.push(["backup_code", code]);

		rows.push(
			...factors.map(([type, secret]) => ({
				user_id: auth.user_id,
				type,
				secret,
				meta: "{}",
				created_on: auth.created_on,
				modified_on: auth.modified_on,
			})),
		);
	}

	if (rows.length > 0) await knex("auth").insert(rows);

	await knex("auth").where("type", "password").update({ meta: "{}" });

	logger.info(`[${migrateName}] ${rows.length} second factors moved to their own rows`);
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
