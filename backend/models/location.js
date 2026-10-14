// Objection Docs:
// http://vincit.github.io/objection.js/

import { Model } from "objection";
import db from "../db.js";
import { convertBoolFieldsToInt, convertIntFieldsToBool } from "../lib/helpers.js";
import AccessList from "./access_list.js";

Model.knex(db());

const boolFields = [
	"npmplus_enabled",
	"npmplus_noindex",
	"npmplus_crowdsec_appsec",
	"npmplus_proxy_request_buffering",
	"npmplus_proxy_response_buffering",
	"npmplus_upstream_compression",
	"npmplus_fancyindex",
];

class Location extends Model {
	$beforeInsert() {
		this.advanced_config ??= "";
	}

	$parseDatabaseJson(json) {
		const thisJson = convertIntFieldsToBool(super.$parseDatabaseJson(json), boolFields);

		if (thisJson.npmplus_load_balance_method === null) {
			delete thisJson.npmplus_load_balance_method;
		}
		if (thisJson.npmplus_forward_path === null) {
			delete thisJson.npmplus_forward_path;
		}

		return thisJson;
	}

	$formatDatabaseJson(json) {
		return super.$formatDatabaseJson(convertBoolFieldsToInt(json, boolFields));
	}

	static get name() {
		return "Location";
	}

	static get tableName() {
		return "npmplus_location";
	}

	static get relationMappings() {
		return {
			access_lists: {
				relation: Model.ManyToManyRelation,
				modelClass: AccessList,
				join: {
					from: "npmplus_location.id",
					through: {
						from: "npmplus_proxy_host_access_list.location_id",
						to: "npmplus_proxy_host_access_list.access_list_id",
					},
					to: "access_list.id",
				},
				modify: (qb) => {
					qb.orderBy("npmplus_proxy_host_access_list.position");
				},
			},
		};
	}

	static get jsonAttributes() {
		return ["npmplus_upstream_servers"];
	}
}

export default Location;
