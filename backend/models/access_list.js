// Objection Docs:
// http://vincit.github.io/objection.js/

import { Model } from "objection";
import db from "../db.js";
import { convertBoolFieldsToInt, convertIntFieldsToBool } from "../lib/helpers.js";
import AccessListAuth from "./access_list_auth.js";
import AccessListClient from "./access_list_client.js";
import now from "./now_helper.js";
import ProxyHost from "./proxy_host.js";
import User from "./user.js";

Model.knex(db());

const boolFields = ["satisfy_any", "pass_auth"];

class AccessList extends Model {
	$beforeInsert() {
		this.created_on = now();
		this.modified_on = now();

		// Default for meta
		this.meta ??= {};
	}

	$beforeUpdate() {
		this.modified_on = now();
	}

	$parseDatabaseJson(json) {
		const { is_deleted, meta, ...thisJson } = super.$parseDatabaseJson(json);
		thisJson.proxy_host_count &&= Number(thisJson.proxy_host_count);
		return convertIntFieldsToBool(thisJson, boolFields);
	}

	$formatDatabaseJson(json) {
		const thisJson = convertBoolFieldsToInt(json, boolFields);
		return super.$formatDatabaseJson(thisJson);
	}

	static tableName = "access_list";

	static jsonAttributes = ["meta"];

	static get relationMappings() {
		return {
			owner: {
				relation: Model.HasOneRelation,
				modelClass: User,
				join: {
					from: "access_list.owner_user_id",
					to: "user.id",
				},
			},
			items: {
				relation: Model.HasManyRelation,
				modelClass: AccessListAuth,
				join: {
					from: "access_list.id",
					to: "access_list_auth.access_list_id",
				},
				modify: (qb) => {
					qb.orderBy("access_list_auth.id");
				},
			},
			clients: {
				relation: Model.HasManyRelation,
				modelClass: AccessListClient,
				join: {
					from: "access_list.id",
					to: "access_list_client.access_list_id",
				},
				modify: (qb) => {
					qb.orderBy("access_list_client.id");
				},
			},
			proxy_hosts: {
				relation: Model.ManyToManyRelation,
				modelClass: ProxyHost,
				join: {
					from: "access_list.id",
					through: {
						from: "npmplus_proxy_host_access_list.access_list_id",
						to: "npmplus_proxy_host_access_list.proxy_host_id",
					},
					to: "proxy_host.id",
				},
			},
		};
	}
}

export default AccessList;
