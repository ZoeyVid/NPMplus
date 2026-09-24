import { createGuardrails, generateSecret, generateURI, verify } from "otplib";
import errs from "../lib/error.js";
import authModel from "../models/auth.js";
import userModel from "../models/user.js";
import internalAuditLog from "./audit-log.js";
import internalUser from "./user.js";

const APP_NAME = "NPMplus";

const usedSteps = new Map();

const internalTotp = {
	/**
	 * Check if user has TOTP enabled
	 * @param {number} userId
	 * @returns {Promise<boolean>}
	 */
	isEnabled: async (userId) =>
		(await authModel.query().where("user_id", userId).andWhere("type", "totp").resultSize()) > 0,

	/**
	 * Start TOTP setup - store pending secret
	 *
	 * @param   {Access}  access
	 * @param   {number} userId
	 * @returns {Promise<{secret: string, otpauth_url: string}>}
	 */
	startSetup: async (access, userId) => {
		if (Number(userId) !== access.token.getUserId(0)) {
			throw new errs.PermissionError("TOTP can only be managed for your own account");
		}
		const user = await internalUser.get(access, { id: userId });

		// ensure user isn't already setup for totp
		if (await internalTotp.isEnabled(userId)) {
			throw new errs.ValidationError("TOTP is already enabled");
		}

		const secret = generateSecret();
		const otpauth_url = generateURI({
			issuer: APP_NAME,
			label: user.email,
			secret,
		});

		await authModel.query().where("user_id", userId).andWhere("type", "totp_pending").delete();
		await authModel.query().insert({ user_id: userId, type: "totp_pending", secret, meta: {} });

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
		if (Number(userId) !== access.token.getUserId(0)) {
			throw new errs.PermissionError("TOTP can only be managed for your own account");
		}
		const user = await internalUser.get(access, { id: userId });

		if (await internalTotp.isEnabled(userId)) {
			throw new errs.ValidationError("TOTP is already enabled");
		}

		const pending = await authModel.query().where("user_id", userId).andWhere("type", "totp_pending").first();

		if (!pending) {
			throw new errs.ValidationError("No pending TOTP setup found");
		}

		// a setup which was not confirmed within 10 minutes has to be started again
		if (Date.now() - new Date(pending.created_on).getTime() > 600000) {
			throw new errs.ValidationError("TOTP setup has expired");
		}

		const result = await verify({ token: code, secret: pending.secret });
		if (!result.valid) {
			throw new errs.ValidationError("Invalid verification code");
		}

		const enabled = await authModel
			.query()
			.findById(pending.id)
			.andWhere("type", "totp_pending")
			.patch({ type: "totp" });

		if (enabled !== 1) {
			throw new errs.ValidationError("No pending TOTP setup found");
		}
		usedSteps.set(pending.id, result.timeStep);

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
		await authModel.query().where("user_id", userId).whereIn("type", ["totp", "totp_pending"]).delete();

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
		const enrolled = await authModel.query().where("user_id", userId).andWhere("type", "totp").first();

		if (!enrolled) {
			return false;
		}

		const result = await verify({
			token: code,
			secret: enrolled.secret,
			// These guardrails lower the minimum length requirement for secrets.
			// In v12 of otplib the default minimum length is 10 and in v13 it is 16.
			// Since there are totp secrets in the wild generated with v12 we need to allow shorter secrets
			// so people won't be locked out when upgrading.
			guardrails: createGuardrails({
				MIN_SECRET_BYTES: 10,
			}),
		});

		if (!result.valid || usedSteps.get(enrolled.id) >= result.timeStep) return false;

		usedSteps.set(enrolled.id, result.timeStep);
		return true;
	},
};

export default internalTotp;
