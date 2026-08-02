import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import errs from "../lib/error.js";
import authModel from "../models/auth.js";
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
		const code = crypto.randomBytes(4).toString("hex").toUpperCase();
		plain.push(code);
		const hash = await bcrypt.hash(code, 10);
		hashed.push(hash);
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
		await access.can("users:password", userId);
		await internalUser.get(access, { id: userId });
		const auth = await authModel.getPasswordAuth(userId);

		return {
			totp_enabled: await totp.isEnabled(userId),
			backup_codes_remaining: (auth?.meta?.backup_codes || []).length,
		};
	},

	/**
	 * Generate backup codes if none exist yet (when the first factor gets enabled)
	 *
	 * @param   {number} userId
	 * @returns {Promise<{backup_codes: string[]} | null>}
	 */
	ensureBackupCodes: async (userId) => {
		const auth = await authModel.getPasswordAuth(userId);
		if (auth?.meta?.backup_codes) {
			return null;
		}

		const { plain, hashed } = await generateBackupCodes();
		const meta = { ...auth.meta, backup_codes: hashed };
		await authModel
			.query()
			.where("id", auth.id)
			.andWhere("user_id", userId)
			.andWhere("type", "password")
			.patch({ meta });

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
		await access.can("users:password", userId);
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
			const auth = await authModel.getPasswordAuth(userId);
			const meta = { ...auth.meta };
			delete meta.backup_codes;
			await authModel
				.query()
				.where("id", auth.id)
				.andWhere("user_id", userId)
				.andWhere("type", "password")
				.patch({ meta });
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
		const tokenTrim = token.trim();

		// TOTP codes are 6 chars, backup codes are 8 chars
		if (tokenTrim.length === 6) {
			return await totp.verifyCode(userId, tokenTrim);
		}

		if (tokenTrim.length === 8) {
			const auth = await authModel.getPasswordAuth(userId);
			const backupCodes = auth?.meta?.backup_codes || [];
			for (let i = 0; i < backupCodes.length; i++) {
				const match = await bcrypt.compare(tokenTrim.toUpperCase(), backupCodes[i]);
				if (match) {
					// Remove used backup code
					const updatedCodes = [...backupCodes];
					updatedCodes.splice(i, 1);
					const meta = { ...auth.meta, backup_codes: updatedCodes };
					await authModel
						.query()
						.where("id", auth.id)
						.andWhere("user_id", userId)
						.andWhere("type", "password")
						.patch({ meta });
					return true;
				}
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
		await access.can("users:mfadisable", userId);
		if (Number(userId) === access.token.getUserId(0)) {
			throw new errs.ValidationError("MFA can not be reset for your own account");
		}
		const user = await internalUser.get(access, { id: userId });

		if (!(await internalMfa.isAnyEnabled(userId))) {
			throw new errs.ValidationError("MFA is not enabled");
		}

		await totp.disable(access, userId, false);

		const auth = await authModel.getPasswordAuth(userId);
		const meta = { ...auth.meta };
		delete meta.backup_codes;

		await authModel
			.query()
			.where("id", auth.id)
			.andWhere("user_id", userId)
			.andWhere("type", "password")
			.patch({ meta });

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
		await access.can("users:password", userId);
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

		const auth = await authModel.getPasswordAuth(userId);
		const { plain, hashed } = await generateBackupCodes();

		const meta = { ...auth.meta, backup_codes: hashed };
		await authModel
			.query()
			.where("id", auth.id)
			.andWhere("user_id", userId)
			.andWhere("type", "password")
			.patch({ meta });

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
