import { migrate as logger } from "../logger.js";

const migrateName = "nickname_default";

const up = async (knex) => {
	logger.info(`[${migrateName}] Migrating Up...`);

	await knex.schema.alterTable("user", (table) => {
		table.string("nickname").notNull().defaultTo("").alter();
	});

	logger.info(`[${migrateName}] user Table altered`);
};

const down = (_knex) => {
	throw new Error(`[${migrateName}] You can't migrate down this one.`);
};

export { down, up };
