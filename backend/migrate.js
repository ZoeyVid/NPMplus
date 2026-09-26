import { chmod, mkdir, readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import Database from "better-sqlite3";
import db from "./db.js";
import { isSqlite } from "./lib/config.js";
import { migrate as logger } from "./logger.js";

const databaseFile = "/data/npmplus/database.sqlite";
const backupDirectory = "/data/npmplus/backups";
const backupPattern = /^database-migrations-.+\.sqlite$/;

const migrationConfig = {
	tableName: "migrations",
	directory: "migrations",
};

let currentBackup = null;
let oldBackups = [];

const getMigrationBackups = async () => {
	await mkdir(backupDirectory, {
		recursive: true,
		mode: 0o700,
	});

	const entries = await readdir(backupDirectory, {
		withFileTypes: true,
	});

	return entries
		.filter((entry) => entry.isFile() && backupPattern.test(entry.name))
		.map((entry) => join(backupDirectory, entry.name));
};

const createMigrationBackup = async () => {
	// Reuse the backup if appStart retries after a failed migration.
	if (currentBackup !== null) {
		return;
	}
	oldBackups = await getMigrationBackups();

	const date = new Date().toISOString().replace(/[:.]/g, "-");

	currentBackup = join(backupDirectory, `database-migrations-${date}.sqlite`);

	const sqlite = new Database(databaseFile, {	fileMustExist: true });

	try {
		await sqlite.backup(currentBackup);
		await chmod(currentBackup, 0o600);
		logger.info(`Created pre-migration database backup: ${currentBackup}`);
	} catch (err) {
		currentBackup = null;
		throw err;
	} finally {
		sqlite.close();
	}
};

const removeOldMigrationBackups = async () => {
	for (const backup of oldBackups) {
		try {
			await unlink(backup);
			logger.info(`Removed old migration database backup: ${backup}`);
		} catch (err) {
			logger.warn(`Could not remove old migration database backup ${backup}: ${err.message}`);
		}
	}
	oldBackups = [];
	currentBackup = null;
};

const migrateUp = async () => {
	const [completedMigrations, pendingMigrations] =
	await db().migrate.list(migrationConfig);

	const shouldBackup =
		isSqlite() &&
		completedMigrations.length > 0 &&
		pendingMigrations.length > 0;

	if (shouldBackup) {
		await createMigrationBackup();
	}

	const version = await db().migrate.currentVersion(migrationConfig);
	logger.info("Current database version:", version);

	const result = await db().migrate.latest(migrationConfig);

	if (isSqlite()) {
		await db().raw("PRAGMA journal_mode = WAL");
		await db().raw("PRAGMA auto_vacuum = 1");
		await db().raw("VACUUM");
		await db().raw("PRAGMA optimize");
		logger.info("Sqlite database vacuumed");
	}
	if (shouldBackup) {
		await removeOldMigrationBackups();
	}

	return result;
};

export { migrateUp };
