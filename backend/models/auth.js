// Objection Docs:
// http://vincit.github.io/objection.js/

import bcrypt from "bcryptjs";
import { Model } from "objection";
import db from "../db.js";
import { convertBoolFieldsToInt, convertIntFieldsToBool } from "../lib/helpers.js";
import now from "./now_helper.js";
import User from "./user.js";

Model.knex(db());

const boolFields = ["is_deleted"];

async function encryptPassword() {
	if (this.type === "password" && this.secret) {
		this.secret = await bcrypt.hash(this.secret, 13);
	}
}

class Auth extends Model {
	async $beforeInsert(queryContext) {
		this.created_on = now();
		this.modified_on = now();

		// Default for meta
		if (typeof this.meta === "undefined") {
			this.meta = {};
		}

		await encryptPassword.apply(this, queryContext);
	}

	async $beforeUpdate(queryContext) {
		this.modified_on = now();
		await encryptPassword.apply(this, queryContext);
	}

	$parseDatabaseJson(json) {
		const thisJson = super.$parseDatabaseJson(json);
		return convertIntFieldsToBool(thisJson, boolFields);
	}

	$formatDatabaseJson(json) {
		const thisJson = convertBoolFieldsToInt(json, boolFields);
		return super.$formatDatabaseJson(thisJson);
	}

	/**
	 * Verify a plain password against the encrypted password
	 *
	 * @param {String} password
	 * @returns {Promise}
	 */
	verifyPassword(password) {
		return bcrypt.compare(password, this.secret);
	}

	static get name() {
		return "Auth";
	}

	static get tableName() {
		return "auth";
	}

	static get jsonAttributes() {
		return ["meta"];
	}

	static get relationMappings() {
		return {
			user: {
				relation: Model.HasOneRelation,
				modelClass: User,
				join: {
					from: "auth.user_id",
					to: "user.id",
				},
				filter: {
					is_deleted: 0,
				},
			},
		};
	}
}

export default Auth;
