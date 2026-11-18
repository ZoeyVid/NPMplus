import { migrate as logger } from "../logger.js";

const migrateName = "drop_dns_challenge";

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

	await knex("certificate").where("npmplus_dns_challenge", 0).update({
		npmplus_dns_provider: "",
		npmplus_dns_provider_credentials: "",
		npmplus_propagation_seconds: 0,
	});

	await knex.schema.table("certificate", (certificate) => {
		certificate.dropColumn("npmplus_dns_challenge");
	});

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
