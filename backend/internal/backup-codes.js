import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { hash, verify } from "../lib/argon2.js";
import authModel from "../models/auth.js";

const codesOf = (userId) => authModel.query().where("user_id", userId).andWhere("type", "backup_code");

/**
 * Generate backup codes
 *
 * @returns {Promise<{plain: string[], hashed: string[]}>}
 */
const generate = async () => {
	const plain = [];
	const hashed = [];

	for (let i = 0; i < 8; i++) {
		// biome-ignore lint/security/noSecrets: Crockford Base32 alphabet
		const code = Array.from({ length: 8 }, () => "0123456789ABCDEFGHJKMNPQRSTVWXYZ"[crypto.randomInt(32)]).join("");
		plain.push(code);
		hashed.push(await hash(code, true));
	}

	return { plain, hashed };
};

const internalBackupCodes = {
	/**
	 * Count the backup codes which are still unused
	 *
	 * @param   {number} userId
	 * @returns {Promise<number>}
	 */
	count: async (userId) => await codesOf(userId).resultSize(),

	/**
	 * Replace all backup codes of a user with a freshly generated set
	 *
	 * @param   {number} userId
	 * @returns {Promise<string[]>}
	 */
	create: async (userId) => {
		const { plain, hashed } = await generate();

		await codesOf(userId).delete();
		for (const secret of hashed) {
			await authModel.query().insert({ user_id: userId, type: "backup_code", secret, meta: {} });
		}

		return plain;
	},

	/**
	 * Remove all backup codes of a user
	 *
	 * @param   {number} userId
	 * @returns {Promise<void>}
	 */
	delete: async (userId) => {
		await codesOf(userId).delete();
	},

	/**
	 * Verify a backup code and consume it
	 *
	 * @param   {number} userId
	 * @param   {string} code
	 * @returns {Promise<boolean>}
	 */
	verify: async (userId, code) => {
		const codeTrim = code.trim().toUpperCase().replace(/O/g, "0").replace(/[IL]/g, "1");

		for (const row of await codesOf(userId)) {
			const match = row.secret.startsWith("$2")
				? await bcrypt.compare(codeTrim, row.secret)
				: await verify(codeTrim, row.secret);
			// Remove used backup code, only the request that removes it counts as used
			if (match) return (await authModel.query().findById(row.id).delete()) === 1;
		}

		return false;
	},
};

export default internalBackupCodes;
