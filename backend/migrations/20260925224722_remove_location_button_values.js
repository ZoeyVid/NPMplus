import { migrate as logger } from "../logger.js";

const migrateName = "remove_location_button_values";

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

	const fields = [
		"caching_enabled",
		"block_exploits",
		"allow_websocket_upgrade",
		"npmplus_fancyindex_upstream_compression",
		"npmplus_disable_uri_sanitisation",
		"npmplus_spoof_host_header",
	];
	for (const row of await knex("proxy_host").where("is_deleted", 0).select("id", "locations")) {
		const locations = Array.isArray(row.locations) ? row.locations : JSON.parse(row.locations || "[]");
		if (!locations.some((location) => fields.some((field) => location[field] !== undefined))) continue;
		for (const location of locations) for (const field of fields) delete location[field];
		await knex("proxy_host")
			.where("id", row.id)
			.update({ locations: JSON.stringify(locations) });
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
