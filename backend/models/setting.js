// Objection Docs:
// http://vincit.github.io/objection.js/

import { Model } from "objection";
import db from "../db.js";

Model.knex(db());

class Setting extends Model {
	$beforeInsert() {
		// Default for meta
		this.meta ??= {};
	}

	static tableName = "setting";

	static jsonAttributes = ["meta"];
}

export default Setting;
