import { migrate as logger } from "../logger.js";

const migrateName = "user_is_admin";

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

	await knex.schema.alterTable("user", (table) => {
		table.integer("npmplus_is_admin").notNull().unsigned().defaultTo(0);
	});

	for (const { id, roles } of await knex("user").select("id", "roles")) {
		if ((typeof roles === "string" ? JSON.parse(roles) : roles).includes("admin")) {
			await knex("user").where("id", id).update({ npmplus_is_admin: 1 });
		}
	}

	await knex("user").update({ roles: "[]" });
	await knex.schema.alterTable("user", (table) => {
		table.json("roles").notNull().defaultTo([]).alter();
	});

	logger.info(`[${migrateName}] user Table altered`);
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
