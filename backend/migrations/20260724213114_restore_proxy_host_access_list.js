import { migrate as logger } from "../logger.js";

const migrateName = "restore_proxy_host_access_list";

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
	const relations = [];
	for (const row of await knex("proxy_host").where("is_deleted", 0)) {
		const locations = Array.isArray(row.locations) ? row.locations : JSON.parse(row.locations || "[]");
		for (const { npmplus_access_list_type: type, npmplus_access_list_ids: ids } of [row, ...locations]) {
			if (type !== "custom") continue;
			for (const id of Array.isArray(ids) ? ids : JSON.parse(ids || "[]"))
				if (validIds.has(id)) relations.push({ proxy_host_id: row.id, access_list_id: id });
		}
	}
	if (relations.length > 0) await knex("npmplus_proxy_host_access_list").insert(relations).onConflict().ignore();

	logger.info(`[${migrateName}] npmplus_proxy_host_access_list Table restored`);
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
