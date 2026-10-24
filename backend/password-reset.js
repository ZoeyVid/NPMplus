#!/usr/bin/env node

// based on: https://github.com/jlesage/docker-nginx-proxy-manager/blob/796734a3f9a87e0b1561b47fd418f82216359634/rootfs/opt/nginx-proxy-manager/bin/reset-password

import { existsSync } from "node:fs";
import { createInterface } from "node:readline";
import { Database } from "node:sqlite";
import { Writable } from "node:stream";
import { parseArgs } from "node:util";
import { hash } from "./lib/argon2.js";

function usage() {
	console.log(`usage: ${process.argv[1]} USER_EMAIL [--disable-mfa]

	Set or reset the password and/or disable MFA of a NPMplus user.
	The new password is read from stdin, leave it empty to keep the current one.

	Arguments:
	USER_EMAIL      Email address of the user.

	Options:
	--disable-mfa   Disable TOTP and delete the backup codes of the user.`);
	process.exit(1);
}

let parsed;
try {
	parsed = parseArgs({ allowPositionals: true, options: { "disable-mfa": { type: "boolean" } } });
} catch (error) {
	console.error(`ERROR: ${error.message}`);
	usage();
}
const {
	values: { "disable-mfa": DISABLE_MFA },
	positionals: [email, ...rest],
} = parsed;
const EMAIL = email?.toLowerCase().trim();

if (!EMAIL || rest.length > 0) {
	if (!EMAIL) console.error("ERROR: User email address must be set.");
	usage();
}

if (!existsSync("/data/npmplus/database.sqlite")) {
	console.error("ERROR: Cannot connect to the sqlite database.");
	process.exit(1);
}

process.stdout.write("New password: ");
const rl = createInterface({
	input: process.stdin,
	output: new Writable({ write: (_chunk, _encoding, callback) => callback() }),
	terminal: process.stdin.isTTY,
});
rl.on("SIGINT", () => process.exit(130));
const { value: PASSWORD = "" } = await rl[Symbol.asyncIterator]().next();
rl.close();
process.stdout.write("\n");

if (!PASSWORD && !DISABLE_MFA) {
	console.error("ERROR: Password and/or --disable-mfa must be set.");
	usage();
}

if (PASSWORD && (PASSWORD.length < 8 || PASSWORD.length > 255)) {
	console.error("ERROR: Password must be between 8 and 255 characters long.");
	process.exit(1);
}

try {
	using db = new Database("/data/npmplus/database.sqlite", { timeout: 3000 });
	db.exec("PRAGMA secure_delete = FAST");

	const user = db.prepare("SELECT id FROM user WHERE email = ?").get(EMAIL);

	if (user) {
		if (PASSWORD) {
			const secret = await hash(PASSWORD);
			const { changes } = db
				.prepare(
					"UPDATE auth SET secret = ?, modified_on = datetime('now','localtime') WHERE user_id = ? AND type = 'password'",
				)
				.run(secret, user.id);
			if (!changes) {
				db.prepare(
					"INSERT INTO auth (created_on, modified_on, user_id, type, secret, meta) VALUES (datetime('now','localtime'), datetime('now','localtime'), ?, 'password', ?, '{}')",
				).run(user.id, secret);
			}
			db.prepare("UPDATE user SET npmplus_token_valid_after = ? WHERE id = ?").run(
				Math.floor(Date.now() / 1000),
				user.id,
			);
			console.log(`Password for user ${EMAIL} has been ${changes ? "reset" : "set"}.`);
		}

		if (DISABLE_MFA) {
			db.prepare("DELETE FROM auth WHERE user_id = ? AND type IN ('totp', 'totp_pending', 'backup_code')").run(
				user.id,
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
}
