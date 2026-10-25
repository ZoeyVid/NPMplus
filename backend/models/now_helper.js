import { Model } from "objection";
import db from "../db.js";
import { isMysql, isSqlite } from "../lib/config.js";

Model.knex(db());

export default () => {
	if (isSqlite()) {
		return Model.raw("CURRENT_TIMESTAMP");
	}
	if (isMysql()) {
		return Model.raw("UTC_TIMESTAMP()");
	}
	return Model.raw("NOW()");
};
