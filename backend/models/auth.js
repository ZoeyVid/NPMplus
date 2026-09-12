// Objection Docs:
// http://vincit.github.io/objection.js/

import bcrypt from "bcryptjs";
import { Model } from "objection";
import db from "../db.js";
import { hash, verify } from "../lib/argon2.js";
import { convertBoolFieldsToInt, convertIntFieldsToBool } from "../lib/helpers.js";
import now from "./now_helper.js";
import User from "./user.js";

Model.knex(db());

const boolFields = ["is_deleted"];

async function encryptPassword() {
	if (this.type === "password" && this.secret) {
		this.secret = await hash(this.secret);
		return;
	}

	return null;
}

class Auth extends Model {
	$beforeInsert(queryContext) {
		this.created_on = now();
		this.modified_on = now();

		// Default for meta
		if (typeof this.meta === "undefined") {
			this.meta = {};
		}

		return encryptPassword.apply(this, queryContext);
	}

	$beforeUpdate(queryContext) {
		this.modified_on = now();
		return encryptPassword.apply(this, queryContext);
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
	 * Verify a plain password against the encrypted password, replacing a legacy bcrypt hash on success
	 *
	 * @param {String} password
	 * @returns {Promise}
	 */
	async verifyPassword(password) {
		if (!this.secret.startsWith("$2")) return verify(password, this.secret);
		if (!(await bcrypt.compare(password, this.secret))) return false;

		await this.$query().patch({ type: this.type, secret: password });
		return true;
	}

	/**
	 * Get the password auth row for a user, or undefined if none exists
	 *
	 * @param   {number} userId
	 * @returns {Promise<object|undefined>}
	 */
	static getPasswordAuth(userId) {
		return Auth.query().where("user_id", userId).andWhere("type", "password").first();
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
