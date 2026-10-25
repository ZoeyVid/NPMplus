/**
 NOTE: This is not a database table, this is a model of a Token object that can be created/loaded
 and then has abilities after that.
 */

import crypto from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { getPrivateKey, getPublicKey } from "../lib/config.js";
import errs from "../lib/error.js";
import { global as logger } from "../logger.js";

const ALGO = "Ed25519";
let privateKey;
let publicKey;

export default () => {
	let tokenData = {};

	return {
		/**
		 * @param {Object}  payload
		 * @returns {Promise}
		 */
		create: async ({ expiresIn, ...payload }) => {
			if (!getPrivateKey()) {
				logger.error("Private key is empty!");
			}

			payload.jti = crypto.randomBytes(12).toString("base64url");
			privateKey ??= crypto.createPrivateKey(getPrivateKey());

			// sign with Ed25519
			return {
				token: await new SignJWT(payload)
					.setProtectedHeader({ alg: ALGO })
					.setIssuedAt(payload.iat)
					.setExpirationTime(expiresIn)
					.sign(privateKey),
				payload,
			};
		},

		/**
		 * @param {String} token
		 * @returns {Promise}
		 */
		load: async (token) => {
			if (!getPublicKey()) {
				logger.error("Public key is empty!");
			}

			publicKey ??= crypto.createPublicKey(getPublicKey());

			try {
				({ payload: tokenData } = await jwtVerify(token, publicKey, {
					algorithms: [ALGO],
					requiredClaims: ["uid", "scope", "jti", "iat", "exp"],
				}));
			} catch (err) {
				if (err.code === "ERR_JWT_EXPIRED") {
					throw new errs.PermissionError("Token has expired", undefined, { cause: err });
				}
				throw err;
			}

			return tokenData;
		},

		/**
		 * Does the token have the specified scope?
		 *
		 * @param   {String}  scope
		 * @returns {Boolean}
		 */
		hasScope: (scope) => tokenData.scope === scope,

		/**
		 * @param   [defaultValue]
		 * @returns {Integer}
		 */
		getUserId: (defaultValue) => tokenData.uid || defaultValue || 0,
	};
};
