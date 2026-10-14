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
		return convertIntFieldsToBool(super.$parseDatabaseJson(json), boolFields);
	}

	$formatDatabaseJson(json) {
		return super.$formatDatabaseJson(convertBoolFieldsToInt(json, boolFields));
	}

	static tableName = "npmplus_location";

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
}

export default Location;
