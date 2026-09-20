import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { hash, verify } from "../lib/argon2.js";
import errs from "../lib/error.js";
import authModel from "../models/auth.js";
import userModel from "../models/user.js";
import internalAuditLog from "./audit-log.js";
import totp from "./totp.js";
import internalUser from "./user.js";

const BACKUP_CODE_COUNT = 8;

/**
 * Generate backup codes
 * @returns {Promise<{plain: string[], hashed: string[]}>}
 */
const generateBackupCodes = async () => {
	const plain = [];
	const hashed = [];

	for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
		// biome-ignore lint/security/noSecrets: Crockford Base32 alphabet
		const code = Array.from({ length: 8 }, () => "0123456789ABCDEFGHJKMNPQRSTVWXYZ"[crypto.randomInt(32)]).join("");
		plain.push(code);
		hashed.push(await hash(code, true));
	}

	return { plain, hashed };
};

const internalMfa = {
	/**
	 * Check if any second factor is enabled for the user
	 *
	 * @param   {number} userId
	 * @returns {Promise<boolean>}
	 */
	isAnyEnabled: async (userId) => await totp.isEnabled(userId),

	/**
	 * Get MFA status for user (all factors and backup codes)
	 *
	 * @param   {Access}  access
	 * @param   {number}  userId
	 * @returns {Promise<{totp_enabled: boolean, backup_codes_remaining: number}>}
	 */
	getStatus: async (access, userId) => {
		access.canUser(userId);
		await internalUser.get(access, { id: userId });

		return {
			totp_enabled: await totp.isEnabled(userId),
			backup_codes_remaining: await authModel
				.query()
				.where("user_id", userId)
				.andWhere("type", "backup_code")
				.resultSize(),
		};
	},

	/**
	 * Generate backup codes if none exist yet (when the first factor gets enabled)
	 *
	 * @param   {number} userId
	 * @returns {Promise<{backup_codes: string[]} | null>}
	 */
	ensureBackupCodes: async (userId) => {
		if (await authModel.query().where("user_id", userId).andWhere("type", "backup_code").resultSize()) {
			return null;
		}

		const { plain, hashed } = await generateBackupCodes();
		for (const secret of hashed) {
			await authModel.query().insert({ user_id: userId, type: "backup_code", secret, meta: {} });
		}

		return { backup_codes: plain };
	},

	/**
	 * Enable TOTP and ensure backup codes exist
	 *
	 * @param   {Access}  access
	 * @param   {number}  userId
	 * @param   {string}  code
	 * @returns {Promise<{backup_codes: string[] | null}>}
	 */
	enableTotp: async (access, userId, code) => {
		await totp.enable(access, userId, code);
		const codes = await internalMfa.ensureBackupCodes(userId);
		return codes ?? { backup_codes: null };
	},

	/**
	 * Disable TOTP; removes backup codes if no factor is left
	 *
	 * @param   {Access}  access
	 * @param   {number}  userId
	 * @param   {string}  code
	 * @returns {Promise<void>}
	 */
	disableTotp: async (access, userId, code) => {
		if (Number(userId) !== access.token.getUserId(0)) {
			throw new errs.PermissionError("TOTP can only be managed for your own account");
		}
		if (!(await totp.isEnabled(userId))) {
			throw new errs.ValidationError("TOTP is not enabled");
		}
		if (!(await internalMfa.verifyForLogin(userId, code))) {
			throw new errs.ValidationError("Invalid verification code");
		}

		await totp.disable(access, userId);

		if (!(await internalMfa.isAnyEnabled(userId))) {
			await authModel.query().where("user_id", userId).andWhere("type", "backup_code").delete();
		}
	},

	/**
	 * Verify a login code (TOTP code or backup code)
	 *
	 * @param   {number} userId
	 * @param   {string} token
	 * @returns {Promise<boolean>}
	 */
	verifyForLogin: async (userId, token) => {
		const tokenTrim = token.trim().toUpperCase().replace(/O/g, "0").replace(/[IL]/g, "1");

		// TOTP codes are 6 chars, backup codes are 8 chars
		if (tokenTrim.length === 6) {
			return totp.verifyCode(userId, tokenTrim);
		}

		if (tokenTrim.length === 8) {
			for (const code of await authModel.query().where("user_id", userId).andWhere("type", "backup_code")) {
				const match = code.secret.startsWith("$2")
					? await bcrypt.compare(tokenTrim, code.secret)
					: await verify(tokenTrim, code.secret);
				// Remove used backup code, only the request that removes it counts as used
				if (match) return (await authModel.query().findById(code.id).delete()) === 1;
			}
		}

		return false;
	},

	/**
	 * Admin reset: disable all second factors and backup codes for a user
	 *
	 * @param   {Access}  access
	 * @param   {number}  userId
	 * @returns {Promise<void>}
	 */
	adminDisable: async (access, userId) => {
		access.canAdmin();
		if (Number(userId) === access.token.getUserId(0)) {
			throw new errs.ValidationError("MFA can not be reset for your own account");
		}
		const user = await internalUser.get(access, { id: userId });

		if (!(await internalMfa.isAnyEnabled(userId))) {
			throw new errs.ValidationError("MFA is not enabled");
		}

		await totp.disable(access, userId, false);
		await authModel.query().where("user_id", userId).andWhere("type", "backup_code").delete();

		await internalAuditLog.add(access, {
			action: "updated",
			object_type: "user",
			object_id: user.id,
			meta: {
				name: user.name,
				totp_enabled: false,
				recovery: true,
			},
		});
	},

	/**
	 * Regenerate backup codes
	 *
	 * @param   {Access}  access
	 * @param   {number}  userId
	 * @param   {string}  token
	 * @returns {Promise<{backup_codes: string[]}>}
	 */
	regenerateBackupCodes: async (access, userId, token) => {
		if (Number(userId) !== access.token.getUserId(0)) {
			throw new errs.PermissionError("MFA can only be managed for your own account");
		}
		const user = await internalUser.get(access, { id: userId });

		if (!(await internalMfa.isAnyEnabled(userId))) {
			throw new errs.ValidationError("MFA is not enabled");
		}

		const tokenTrim = token.trim();

		if (tokenTrim.length !== 6) {
			throw new errs.ValidationError("Invalid verification code");
		}
		if (!(await totp.verifyCode(userId, tokenTrim))) {
			throw new errs.ValidationError("Invalid verification code");
		}

		const { plain, hashed } = await generateBackupCodes();

		await authModel.query().where("user_id", userId).andWhere("type", "backup_code").delete();
		for (const secret of hashed) {
			await authModel.query().insert({ user_id: userId, type: "backup_code", secret, meta: {} });
		}

		await userModel
			.query()
			.where("id", userId)
			.patch({ npmplus_token_valid_after: Math.floor(Date.now() / 1000) });

		await internalAuditLog.add(access, {
			action: "updated",
			object_type: "user",
			object_id: user.id,
			meta: {
				name: user.name,
				backup_codes_regenerated: true,
			},
		});

		return { backup_codes: plain };
	},
};

export default internalMfa;
