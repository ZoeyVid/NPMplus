/**
 NOTE: This is not a database table, this is a model of a Token object that can be created/loaded
 and then has abilities after that.
 */

import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { getPrivateKey, getPublicKey } from "../lib/config.js";
import errs from "../lib/error.js";
import { global as logger } from "../logger.js";

const ALGO = "ES512";

export default () => {
	let tokenData = {};

	return {
		/**
		 * @param {Object}  payload
		 * @returns {Object}
		 */
		create: (payload) => {
			if (!getPrivateKey()) {
				logger.error("Private key is empty!");
			}
			// sign with ECDSA P-521 SHA-512
			const options = {
				algorithm: ALGO,
				expiresIn: payload.expiresIn || "1d",
			};

			payload.jti = crypto.randomBytes(12).toString("base64url");

			return { token: jwt.sign(payload, getPrivateKey(), options), payload };
		},

		/**
		 * @param {String} token
		 * @returns {Object}
		 */
		load: (token) => {
			if (!getPublicKey()) {
				logger.error("Public key is empty!");
			}

			try {
				tokenData = jwt.verify(token, getPublicKey(), { algorithms: [ALGO] });
			} catch (err) {
				if (err.name === "TokenExpiredError") {
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
		hasScope: (scope) => tokenData.scope?.includes(scope) ?? false,

		/**
		 * @param   [defaultValue]
		 * @returns {Integer}
		 */
		getUserId: (defaultValue) => tokenData.attrs?.id || defaultValue || 0,
	};
};
