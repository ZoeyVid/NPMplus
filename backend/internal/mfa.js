import errs from "../lib/error.js";
import userModel from "../models/user.js";
import internalAuditLog from "./audit-log.js";
import backupCodes from "./backup-codes.js";
import totp from "./totp.js";
import internalUser from "./user.js";

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
			backup_codes_remaining: await backupCodes.count(userId),
		};
	},

	/**
	 * Generate backup codes if none exist yet (when the first factor gets enabled)
	 *
	 * @param   {number} userId
	 * @returns {Promise<{backup_codes: string[]} | null>}
	 */
	ensureBackupCodes: async (userId) => {
		if (await backupCodes.count(userId)) {
			return null;
		}

		return { backup_codes: await backupCodes.create(userId) };
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
			await backupCodes.delete(userId);
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
		// TOTP codes are 6 chars, backup codes are 8 chars
		if (token.length === 6) {
			return await totp.verifyCode(userId, token);
		}

		if (token.length === 8) {
			return await backupCodes.verify(userId, token);
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
		await backupCodes.delete(userId);

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

		if (token.length !== 6) {
			throw new errs.ValidationError("Invalid verification code");
		}
		if (!(await totp.verifyCode(userId, token))) {
			throw new errs.ValidationError("Invalid verification code");
		}

		const plain = await backupCodes.create(userId);

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
