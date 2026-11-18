import db from "./db.js";
import { isSqlite } from "./lib/config.js";
import { migrate as logger } from "./logger.js";

const migrateUp = async () => {
	if (await db().schema.hasTable("migrations")) {
		await db()
			.from("migrations")
			.whereIn("name", [
				"14022026145603_http3_support.js",
				"20260161994605_reset_button_values.js",
				"202602081406011_new_proxy_buttons.js",
				"202602142050081_new_and_split_proxy_buttons.js",
				"20261402145603_http3_support.js",
			])
			.delete();
	}
	const version = await db().migrate.currentVersion({ tableName: "migrations" });
	logger.info("Current database version:", version);
	const result = await db().migrate.latest({
		tableName: "migrations",
		directory: "migrations",
	});

	if (isSqlite()) {
		await db().raw("PRAGMA journal_mode = WAL");
		await db().raw("PRAGMA auto_vacuum = 1");
		await db().raw("VACUUM");
		await db().raw("PRAGMA wal_checkpoint = TRUNCATE");
		await db().raw("PRAGMA optimize");
		logger.info("Sqlite database vacuumed");
	}

	return result;
};

export { migrateUp };
