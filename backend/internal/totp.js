import { createGuardrails, generateSecret, generateURI, verify } from "otplib";
import errs from "../lib/error.js";
import authModel from "../models/auth.js";
import internalAuditLog from "./audit-log.js";
import internalUser from "./user.js";

const APP_NAME = "NPMplus";

const internalTotp = {
	/**
	 * Check if user has TOTP enabled
	 * @param {number} userId
	 * @returns {Promise<boolean>}
	 */
	isEnabled: async (userId) => {
		const auth = await authModel.getPasswordAuth(userId);
		return auth?.meta?.totp_enabled === true;
	},

	/**
	 * Start TOTP setup - store pending secret
	 *
	 * @param   {Access}  access
	 * @param   {number} userId
	 * @returns {Promise<{secret: string, otpauth_url: string}>}
	 */
	startSetup: async (access, userId) => {
		await access.can("users:password", userId);
		if (Number(userId) !== access.token.getUserId(0)) {
			throw new errs.PermissionError("TOTP can only be managed for your own account");
		}
		const user = await internalUser.get(access, { id: userId });
		const secret = generateSecret();
		const otpauth_url = generateURI({
			issuer: APP_NAME,
			label: user.email,
			secret,
		});
		const auth = await authModel.getPasswordAuth(userId);

		if (!auth) throw new errs.ItemNotFoundError("Auth not found");

		// ensure user isn't already setup for totp
		const enabled = auth?.meta?.totp_enabled === true;
		if (enabled) {
			throw new errs.ValidationError("TOTP is already enabled");
		}

		const meta = auth.meta || {};
		meta.totp_pending_secret = secret;

		await authModel
			.query()
			.where("id", auth.id)
			.andWhere("user_id", userId)
			.andWhere("type", "password")
			.patch({ meta });

		return { secret, otpauth_url };
	},

	/**
	 * Enable TOTP after verifying code
	 *
	 * @param   {Access}  access
	 * @param   {number}  userId
	 * @param   {string}  code
	 * @returns {Promise<void>}
	 */
	enable: async (access, userId, code) => {
		await access.can("users:password", userId);
		if (Number(userId) !== access.token.getUserId(0)) {
			throw new errs.PermissionError("TOTP can only be managed for your own account");
		}
		const user = await internalUser.get(access, { id: userId });
		const auth = await authModel.getPasswordAuth(userId);
		const secret = auth?.meta?.totp_pending_secret || false;

		if (!secret) {
			throw new errs.ValidationError("No pending TOTP setup found");
		}

		const codeTrim = code.trim();

		const result = await verify({ token: codeTrim, secret });
		if (!result.valid) {
			throw new errs.ValidationError("Invalid verification code");
		}

		const meta = {
			...auth.meta,
			totp_secret: secret,
			totp_enabled: true,
			totp_enabled_at: new Date().toISOString(),
		};
		delete meta.totp_pending_secret;

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
				totp_enabled: true,
			},
		});
	},

	/**
	 * Disable TOTP (checks and code verification happen on the MFA layer)
	 *
	 * @param   {Access}  access
	 * @param   {number}  userId
	 * @param   {boolean} audit
	 * @returns {Promise<void>}
	 */
	disable: async (access, userId, audit = true) => {
		const auth = await authModel.getPasswordAuth(userId);

		const meta = { ...auth.meta };
		delete meta.totp_secret;
		delete meta.totp_enabled;
		delete meta.totp_enabled_at;
		delete meta.totp_pending_secret;

		await authModel
			.query()
			.where("id", auth.id)
			.andWhere("user_id", userId)
			.andWhere("type", "password")
			.patch({ meta });

		if (audit) {
			const user = await internalUser.get(access, { id: userId });
			await internalAuditLog.add(access, {
				action: "updated",
				object_type: "user",
				object_id: user.id,
				meta: {
					name: user.name,
					totp_enabled: false,
				},
			});
		}
	},

	/**
	 * Verify a TOTP code
	 *
	 * @param   {number} userId
	 * @param   {string} code
	 * @returns {Promise<boolean>}
	 */
	verifyCode: async (userId, code) => {
		const auth = await authModel.getPasswordAuth(userId);
		const secret = auth?.meta?.totp_secret || false;

		if (!secret) {
			return false;
		}

		const result = await verify({
			token: code,
			secret,
			// These guardrails lower the minimum length requirement for secrets.
			// In v12 of otplib the default minimum length is 10 and in v13 it is 16.
			// Since there are totp secrets in the wild generated with v12 we need to allow shorter secrets
			// so people won't be locked out when upgrading.
			guardrails: createGuardrails({
				MIN_SECRET_BYTES: 10,
			}),
		});

		return result.valid;
	},
};

export default internalTotp;
