import { migrate as logger } from "../logger.js";

const migrateName = "upstream_location_access_list";

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

	const validIds = new Set(await knex("access_list").where("is_deleted", 0).pluck("id"));
	for (const row of await knex("proxy_host").where("is_deleted", 0).select("id", "locations")) {
		const locations = Array.isArray(row.locations) ? row.locations : JSON.parse(row.locations || "[]");
		if (!locations.some((location) => location.access_list_id !== undefined)) continue;
		for (const { access_list_id: id } of locations)
			if (validIds.has(id))
				await knex("npmplus_proxy_host_access_list")
					.insert({ proxy_host_id: row.id, access_list_id: id })
					.onConflict()
					.ignore();
		await knex("proxy_host")
			.where("id", row.id)
			.update({
				locations: JSON.stringify(
					locations.map(({ access_list_id: id, ...location }) =>
						validIds.has(id)
							? { ...location, npmplus_access_list_type: "custom", npmplus_access_list_ids: [id] }
							: location,
					),
				),
			});
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
