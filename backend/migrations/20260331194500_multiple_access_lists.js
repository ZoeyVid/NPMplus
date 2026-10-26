import { migrate as logger } from "../logger.js";

const migrateName = "multiple_access_lists";

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

	await knex.schema.alterTable("proxy_host", (proxy_host) => {
		proxy_host.json("npmplus_access_list_ids").nullable();
		proxy_host.string("npmplus_access_list_type").notNullable().defaultTo("public");
	});
	await knex.schema.createTable("npmplus_proxy_host_access_list", (table) => {
		table.integer("proxy_host_id").unsigned().notNullable();
		table.integer("access_list_id").unsigned().notNullable();
		table.primary(["proxy_host_id", "access_list_id"]);
		table.foreign("proxy_host_id").references("proxy_host.id").onDelete("CASCADE");
		table.foreign("access_list_id").references("access_list.id").onDelete("CASCADE");
	});

	const acl_host_rows = [];

	for (const row of await knex("proxy_host").select("id", "access_list_id", "locations")) {
		// 0 was used for public but now its no longer used for that
		// so ignore 0
		if (row.access_list_id) acl_host_rows.push({ proxy_host_id: row.id, access_list_id: row.access_list_id });

		await knex("proxy_host")
			.where({ id: row.id })
			.update({
				npmplus_access_list_ids: JSON.stringify(row.access_list_id ? [row.access_list_id] : []),
				npmplus_access_list_type: row.access_list_id ? "custom" : "public",
				locations: JSON.stringify(
					(Array.isArray(row.locations) ? row.locations : JSON.parse(row.locations || "[]")).map(
						(location, id) => ({
							...location,
							npmplus_access_list_ids: [],
							npmplus_access_list_type: "global",
							id,
						}),
					),
				),
			});
	}

	for (let i = 0; i < acl_host_rows.length; i += 500) {
		await knex("npmplus_proxy_host_access_list").insert(acl_host_rows.slice(i, i + 500));
	}

	logger.info(`[${migrateName}] proxy_host Table altered`);
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
