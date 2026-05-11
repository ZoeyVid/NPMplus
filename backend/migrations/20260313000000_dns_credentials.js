import { migrate as logger } from "../logger.js";

const migrateName = "dns-credentials";

/**
 * Migrate
 *
 * @see https://knexjs.org/guide/migrations.html#migration-api
 *
 * @param   {Object}  knex
 * @returns {Promise}
 */
const up = (knex) => {
	logger.info(`[${migrateName}] Migrating Up...`);

	return knex.schema
		.createTable("npmplus_dns_credentials", (table) => {
			table.increments().primary();
			table.dateTime("created_on").notNull();
			table.dateTime("modified_on").notNull();
			table.integer("owner_user_id").notNull().unsigned();
			table.string("name").notNull();
			table.string("provider_id").notNull();
			table.text("credentials").notNull();
			table.integer("is_deleted").notNull().unsigned().defaultTo(0);
		})
		.then(() => {
			logger.info(`[${migrateName}] npmplus_dns_credentials Table created`);
		});
};

const down = (knex) => {
	logger.info(`[${migrateName}] Migrating Down...`);

	return knex.schema.dropTableIfExists("npmplus_dns_credentials").then(() => {
		logger.info(`[${migrateName}] npmplus_dns_credentials Table dropped`);
	});
};

export { down, up };
