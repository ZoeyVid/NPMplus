#!/usr/bin/env node

// based on: https://github.com/jlesage/docker-nginx-proxy-manager/blob/796734a3f9a87e0b1561b47fd418f82216359634/rootfs/opt/nginx-proxy-manager/bin/reset-password

import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";

function usage() {
	console.log(`usage: ${process.argv[1]} USER_EMAIL [PASSWORD] [--disable-mfa]

	Reset the password and/or disable MFA of a NPMplus user.

	Arguments:
	USER_EMAIL      Email address of the user.
	PASSWORD        New password of the user, omit it to keep the current one.

	Options:
	--disable-mfa   Disable TOTP and delete the backup codes of the user.`);
	process.exit(1);
}

const args = process.argv.slice(2);
const DISABLE_MFA = args.includes("--disable-mfa");
if (DISABLE_MFA) args.splice(args.indexOf("--disable-mfa"), 1);
const EMAIL = args[0]?.toLowerCase().trim();
const PASSWORD = args[1];

if (!EMAIL || (!PASSWORD && !DISABLE_MFA)) {
	if (!EMAIL) console.error("ERROR: User email address must be set.");
	if (!PASSWORD && !DISABLE_MFA) console.error("ERROR: Password and/or --disable-mfa must be set.");
	usage();
}

if (!existsSync("/data/npmplus/database.sqlite")) {
	console.error("ERROR: Cannot connect to the sqlite database.");
	process.exit(1);
}

let db;
try {
	db = new DatabaseSync("/data/npmplus/database.sqlite");

	const auth = db
		.prepare(
			"SELECT auth.id, auth.meta FROM auth JOIN user ON user.id = auth.user_id WHERE auth.type = 'password' AND auth.is_deleted = 0 AND user.is_deleted = 0 AND user.email = ?",
		)
		.get(EMAIL);

	if (auth) {
		if (PASSWORD) {
			db.prepare("UPDATE auth SET secret = ?, modified_on = datetime('now','localtime') WHERE id = ?").run(
				bcrypt.hashSync(PASSWORD, 13),
				auth.id,
			);
			console.log(`Password for user ${EMAIL} has been reset.`);
		}

		if (DISABLE_MFA) {
			const meta = JSON.parse(auth.meta || "{}");
			for (const key of ["totp_secret", "totp_enabled", "totp_enabled_at", "totp_pending_secret", "backup_codes"])
				delete meta[key];
			db.prepare("UPDATE auth SET meta = ?, modified_on = datetime('now','localtime') WHERE id = ?").run(
				JSON.stringify(meta),
				auth.id,
			);
			console.log(`MFA for user ${EMAIL} has been disabled.`);
		}
	} else {
		console.log(`No user found with email ${EMAIL}.`);
		process.exitCode = 1;
	}
} catch (error) {
	console.error(error);
	process.exitCode = 1;
} finally {
	if (db) db.close();
}
