import { migrate as logger } from "../logger.js";

const migrateName = "meta_to_columns";

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

	for (const tableName of ["proxy_host", "redirection_host", "dead_host", "stream"]) {
		await knex.schema.alterTable(tableName, (table) => {
			table.integer("npmplus_nginx_online").notNull().unsigned().defaultTo(0);
			table.text("npmplus_nginx_err").notNull().defaultTo("");
			table.string("npmplus_directory", 255).notNull().defaultTo("");
			table.integer("npmplus_mtls_certificate_id").notNull().unsigned().defaultTo(0);
			table.integer("npmplus_mtls_verify_client_optional").notNull().unsigned().defaultTo(0);
		});

		for (const row of await knex(tableName).select("id", "meta")) {
			const meta = (typeof row.meta === "string" ? JSON.parse(row.meta) : row.meta) ?? {};
			await knex(tableName)
				.where("id", row.id)
				.update({
					npmplus_nginx_online: meta.nginx_online ? 1 : 0,
					npmplus_nginx_err: typeof meta.nginx_err === "string" ? meta.nginx_err : "",
					npmplus_directory: typeof meta.directory === "string" ? meta.directory.trim() : "",
					npmplus_mtls_certificate_id: Number.parseInt(meta.npmplus_mtls_certificate_id, 10) || 0,
					npmplus_mtls_verify_client_optional: meta.npmplus_mtls_verify_client_optional === true ? 1 : 0,
					meta: "{}",
				});
		}

		logger.info(`[${migrateName}] ${tableName} Table altered`);
	}

	await knex.schema.alterTable("certificate", (table) => {
		table.integer("npmplus_reuse_key").notNull().unsigned().defaultTo(0);
		table.integer("npmplus_dns_challenge").notNull().unsigned().defaultTo(0);
		table.string("npmplus_dns_provider", 255).notNull().defaultTo("");
		table.text("npmplus_dns_provider_credentials").notNull().defaultTo("");
		table.integer("npmplus_propagation_seconds").notNull().unsigned().defaultTo(0);
	});

	for (const row of await knex("certificate").select("id", "meta")) {
		const meta = (typeof row.meta === "string" ? JSON.parse(row.meta) : row.meta) ?? {};
		await knex("certificate")
			.where("id", row.id)
			.update({
				npmplus_reuse_key: meta.reuse_key ? 1 : 0,
				npmplus_dns_challenge: meta.dns_challenge ? 1 : 0,
				npmplus_dns_provider: typeof meta.dns_provider === "string" ? meta.dns_provider : "",
				npmplus_dns_provider_credentials:
					typeof meta.dns_provider_credentials === "string" ? meta.dns_provider_credentials : "",
				npmplus_propagation_seconds: Number.parseInt(meta.propagation_seconds, 10) || 0,
				meta: "{}",
			});
	}

	logger.info(`[${migrateName}] certificate Table altered`);

	for (const tableName of ["access_list", "access_list_auth", "access_list_client", "auth"]) {
		await knex(tableName).update({ meta: "{}" });
		logger.info(`[${migrateName}] ${tableName} Table altered`);
	}
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
