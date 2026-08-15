import db from "./db.js";
import { isSqlite } from "./lib/config.js";
import { migrate as logger } from "./logger.js";

const migrateUp = async () => {
	const version = await db().migrate.currentVersion();
	logger.info("Current database version:", version);
	const result = await db().migrate.latest({
		tableName: "migrations",
		directory: "migrations",
	});

	if (isSqlite()) {
		await db().raw("PRAGMA journal_mode = WAL");
		await db().raw("PRAGMA auto_vacuum = 1");
		await db().raw("VACUUM");
		await db().raw("PRAGMA optimize");
		logger.info("Sqlite database vacuumed");
	}

	return result;
};

export { migrateUp };
