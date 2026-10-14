// Objection Docs:
// http://vincit.github.io/objection.js/

import { Model } from "objection";
import db from "../db.js";
import { jsonReplacer } from "../lib/helpers.js";
import now from "./now_helper.js";
import User from "./user.js";

Model.knex(db());

class AuditLog extends Model {
	$beforeInsert() {
		this.created_on = now();
		this.modified_on = now();

		// Default for meta
		this.meta ??= {};
		this.meta = JSON.parse(JSON.stringify(this.meta, jsonReplacer));
	}

	$beforeUpdate() {
		this.modified_on = now();
	}

	static tableName = "audit_log";

	static jsonAttributes = ["meta"];

	static get relationMappings() {
		return {
			user: {
				relation: Model.HasOneRelation,
				modelClass: User,
				join: {
					from: "audit_log.user_id",
					to: "user.id",
				},
			},
		};
	}
}

export default AuditLog;
