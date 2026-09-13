import { mkdir, rm } from "node:fs/promises";
import internalUser from "../internal/user.js";
import { migrate as logger } from "../logger.js";

const migrateName = "recache_gravatars";

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

	await rm("/data/npmplus/gravatar", { recursive: true, force: true });
	await mkdir("/data/npmplus/gravatar");

	const users = await knex("user").select("id", "email", "name", "avatar").where("is_deleted", 0);
	for (const user of users) {
		if (user.avatar?.startsWith("/images/avatar/")) continue;
		await knex("user")
			.where("id", user.id)
			.update({ avatar: await internalUser.fetchGravatar(user.id, user.email, user.name) });
	}

	logger.info(`[${migrateName}] re-fetched gravatars for ${users.length} users`);
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
