// Objection Docs:
// http://vincit.github.io/objection.js/

import { Model } from "objection";
import db from "../db.js";
import now from "./now_helper.js";

Model.knex(db());

class UserPermission extends Model {
	$beforeInsert() {
		this.created_on = now();
		this.modified_on = now();
	}

	$beforeUpdate() {
		this.modified_on = now();
	}

	$parseDatabaseJson(json) {
		const { meta, ...thisJson } = super.$parseDatabaseJson(json);
		return thisJson;
	}

	static tableName = "user_permission";
}

export default UserPermission;
