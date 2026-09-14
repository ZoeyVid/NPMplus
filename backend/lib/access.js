/**
 * "scope" in this file means "where did this token come from and what is using it". Tokens are created
 * with scope "user" (login) or "mfa-challenge". This is not to be confused with the "role" which could
 * be "user" or "admin".
 */

import TokenModel from "../models/token.js";
import userModel from "../models/user.js";
import errs from "./error.js";

export default function (tokenString) {
	const Token = TokenModel();
	let initialised = false;
	let isAdmin = false;
	let permissions = {};

	/**
	 * Loads the Token object from the token string
	 *
	 * @returns {Promise}
	 */
	this.init = async () => {
		if (initialised) {
			return;
		}

		if (!tokenString) {
			throw new errs.PermissionError();
		}

		const tokenData = await Token.load(tokenString);

		// At this point we need to load the user from the DB and make sure they:
		// - exist (and not soft deleted)
		// - still have the appropriate scopes for this token
		// This is only required when the User ID is supplied or if the token scope has `user`
		if (tokenData.attrs.id || tokenData.scope?.includes("user")) {
			// Has token user id or token user scope
			const user = await userModel
				.query()
				.where("id", tokenData.attrs.id)
				.andWhere("is_deleted", 0)
				.andWhere("is_disabled", 0)
				.allowGraph("[permissions]")
				.withGraphFetched("[permissions]")
				.first();

			if (user) {
				if (tokenData.iat <= user.npmplus_token_valid_after) {
					throw new errs.AuthError("Token has been revoked");
				}

				// make sure user has all scopes of the token
				// The `user` role is not added against the user row, so we have to just add it here to get past this check.
				user.roles.push("user");

				if (!(tokenData.scope ?? []).every((scopeItem) => user.roles.includes(scopeItem))) {
					throw new errs.AuthError("Invalid token scope for User");
				}
				initialised = true;
				isAdmin = user.roles.includes("admin");
				permissions = user.permissions ?? {};
			} else {
				throw new errs.AuthError("User cannot be loaded for Token");
			}
		}
		initialised = true;
	};

	return {
		token: Token,

		get visibility() {
			return permissions.visibility;
		},

		/**
		 *
		 * @returns {Boolean}
		 */
		canAdmin: () => {
			if (isAdmin) return true;
			throw new errs.PermissionError();
		},

		/**
		 *
		 * @param   {Integer}  id
		 * @returns {Boolean}
		 */
		canUser: (id) => {
			if (isAdmin || Number(id) === Token.getUserId(0)) return true;
			throw new errs.PermissionError();
		},

		/**
		 *
		 * @param   {Boolean}  [allowInternal]
		 * @returns {Promise}
		 */
		load: (allowInternal) => {
			if (!tokenString && allowInternal) {
				initialised = true;
				isAdmin = true;
				permissions = { visibility: "all" };
			}
			return this.init();
		},

		/**
		 *
		 * @param {String}  permission
		 * @returns {Boolean}
		 */
		can: (permission) => {
			const [type, required] = permission.split(":");
			const level = permissions[type];
			if (isAdmin || level === "manage" || level === required) return true;
			throw new errs.PermissionError();
		},
	};
}
