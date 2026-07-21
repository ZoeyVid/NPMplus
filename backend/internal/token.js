import errs from "../lib/error.js";
import { parseDatePeriod } from "../lib/helpers.js";
import authModel from "../models/auth.js";
import TokenModel from "../models/token.js";
import userModel from "../models/user.js";
import twoFactor from "./2fa.js";

const ERROR_MESSAGE_INVALID_AUTH = "Invalid email or password";
const ERROR_MESSAGE_INVALID_AUTH_I18N = "error.invalid-auth";
const ERROR_MESSAGE_INVALID_2FA = "Invalid verification code";
const ERROR_MESSAGE_INVALID_2FA_I18N = "error.invalid-2fa";

export default {
	/**
	 * @param   {Object} data
	 * @param   {String} data.identity
	 * @param   {String} data.secret
	 * @returns {Promise}
	 */
	getTokenFromEmail: async (data) => {
		const Token = TokenModel();

		const user = await userModel
			.query()
			.where("email", data.identity.toLowerCase().trim())
			.andWhere("is_deleted", 0)
			.andWhere("is_disabled", 0)
			.first();

		if (!user) {
			throw new errs.AuthError(ERROR_MESSAGE_INVALID_AUTH);
		}

		const auth = await authModel.query().where("user_id", "=", user.id).where("type", "=", "password").first();

		if (!auth) {
			throw new errs.AuthError(ERROR_MESSAGE_INVALID_AUTH);
		}

		const valid = await auth.verifyPassword(data.secret);
		if (!valid) {
			throw new errs.AuthError(ERROR_MESSAGE_INVALID_AUTH, ERROR_MESSAGE_INVALID_AUTH_I18N);
		}

		// Check if 2FA is enabled
		const has2FA = await twoFactor.isEnabled(user.id);
		if (has2FA) {
			// Return challenge token instead of full token
			const challengeToken = await Token.create({
				iss: "api",
				attrs: {
					id: user.id,
				},
				scope: ["2fa-challenge"],
				expiresIn: "3m",
			});

			return {
				requires2fa: true,
				challenge_token: challengeToken.token,
			};
		}

		const signed = await Token.create({
			iss: "api",
			attrs: {
				id: user.id,
			},
			scope: ["user"],
			expiresIn: "1h",
		});

		return {
			token: signed.token,
			expires: parseDatePeriod("1h").toISOString(),
		};
	},

	/**
	 * @param   {Object} data
	 * @param   {String} data.identity
	 * @returns {Promise}
	 */
	getTokenFromOAuthClaim: async (data) => {
		const Token = TokenModel();

		const user = await userModel
			.query()
			.where("email", data.identity.toLowerCase().trim())
			.andWhere("is_deleted", 0)
			.andWhere("is_disabled", 0)
			.first();

		if (!user) {
			throw new errs.AuthError(ERROR_MESSAGE_INVALID_AUTH);
		}

		// Check if 2FA is enabled
		const has2FA = await twoFactor.isEnabled(user.id);
		if (has2FA) {
			// Return challenge token instead of full token
			const challengeToken = await Token.create({
				iss: "api",
				attrs: {
					id: user.id,
				},
				scope: ["2fa-challenge"],
				expiresIn: "3m",
			});

			return {
				requires2fa: true,
				challenge_token: challengeToken.token,
			};
		}

		const signed = await Token.create({
			iss: "api",
			attrs: {
				id: user.id,
			},
			scope: ["user"],
			expiresIn: "1h",
		});

		return {
			token: signed.token,
			expires: parseDatePeriod("1h").toISOString(),
		};
	},

	/**
	 * @param {Access} access
	 * @returns {Promise}
	 */
	getFreshToken: async (access) => {
		const Token = TokenModel();

		if (access?.token.getUserId(0) && access.token.hasScope("user")) {
			const signed = await Token.create({
				iss: "api",
				scope: ["user"],
				attrs: {
					id: access.token.getUserId(0),
				},
				expiresIn: "1h",
			});

			return {
				token: signed.token,
				expires: parseDatePeriod("1h").toISOString(),
			};
		}
		throw new errs.AssertionFailedError("Existing token contained invalid user data");
	},

	/**
	 * Verify 2FA code and return full token
	 * @param {string} challengeToken
	 * @param {string} code
	 * @returns {Promise}
	 */
	verify2FA: async (challengeToken, code) => {
		const Token = TokenModel();

		// Verify challenge token
		let tokenData;
		try {
			tokenData = await Token.load(challengeToken);
		} catch {
			throw new errs.AuthError("Invalid or expired challenge token");
		}

		// Check scope
		if (tokenData.scope?.[0] !== "2fa-challenge") {
			throw new errs.AuthError("Invalid challenge token");
		}

		const userId = tokenData.attrs?.id;
		if (!userId) {
			throw new errs.AuthError("Invalid challenge token");
		}

		// Verify 2FA code
		const valid = await twoFactor.verifyForLogin(userId, code);
		if (!valid) {
			throw new errs.AuthError(ERROR_MESSAGE_INVALID_2FA, ERROR_MESSAGE_INVALID_2FA_I18N);
		}

		const signed = await Token.create({
			iss: "api",
			attrs: {
				id: userId,
			},
			scope: ["user"],
			expiresIn: "1h",
		});

		return {
			token: signed.token,
			expires: parseDatePeriod("1h").toISOString(),
		};
	},
};
