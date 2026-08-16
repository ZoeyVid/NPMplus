import { migrate as logger } from "../logger.js";

const migrateName = "http2_support";

/**
 * Migrate
 *
 * @see https://knexjs.org/guide/migrations.html#migration-api
 *
 * @param   {Object}  knex
 * @returns {Promise}
 */
const up = async (knex) => {
	logger.info(`[${migrateName}] Migrating Up...`);

	await knex.schema.table("proxy_host", (proxy_host) => {
		proxy_host.integer("http2_support").notNull().unsigned().defaultTo(0);
	});

	logger.info(`[${migrateName}] proxy_host Table altered`);

	await knex.schema.table("redirection_host", (redirection_host) => {
		redirection_host.integer("http2_support").notNull().unsigned().defaultTo(0);
	});

	logger.info(`[${migrateName}] redirection_host Table altered`);

	await knex.schema.table("dead_host", (dead_host) => {
		dead_host.integer("http2_support").notNull().unsigned().defaultTo(0);
	});

	logger.info(`[${migrateName}] dead_host Table altered`);
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
