// Objection Docs:
// http://vincit.github.io/objection.js/

import { Model } from "objection";
import db from "../db.js";
import { castJsonIfNeed, convertBoolFieldsToInt, convertIntFieldsToBool } from "../lib/helpers.js";
import AccessList from "./access_list.js";
import Certificate from "./certificate.js";
import now from "./now_helper.js";
import User from "./user.js";

Model.knex(db());

const boolFields = [
	"is_deleted",
	"ssl_forced",
	"caching_enabled",
	"block_exploits",
	"allow_websocket_upgrade",
	"http2_support",
	"npmplus_http3_support",
	"enabled",
	"hsts_enabled",
	"hsts_subdomains",
	"trust_forwarded_proto",
	"npmplus_noindex",
	"npmplus_crowdsec_appsec",
	"npmplus_proxy_request_buffering",
	"npmplus_proxy_response_buffering",
	"npmplus_upstream_compression",
	"npmplus_fancyindex",
];

class ProxyHost extends Model {
	$beforeInsert() {
		this.created_on = now();
		this.modified_on = now();

		// Default for domain_names
		if (typeof this.domain_names === "undefined") {
			this.domain_names = [];
		}

		// Default for meta
		if (typeof this.meta === "undefined") {
			this.meta = {};
		}

		// Default for access list type
		if (typeof this.npmplus_access_list_type === "undefined") {
			this.npmplus_access_list_type = "public";
		}

		// Default for access list ids
		if (typeof this.npmplus_access_list_ids === "undefined") {
			this.npmplus_access_list_ids = [];
		}
	}

	$beforeUpdate() {
		this.modified_on = now();
	}

	$parseDatabaseJson(json) {
		const thisJson = super.$parseDatabaseJson(json);
		return convertIntFieldsToBool(thisJson, boolFields);
	}

	$formatDatabaseJson(json) {
		const thisJson = convertBoolFieldsToInt({ ...json }, boolFields);
		return super.$formatDatabaseJson(thisJson);
	}

	static get name() {
		return "ProxyHost";
	}

	static get tableName() {
		return "proxy_host";
	}

	static get jsonAttributes() {
		return ["domain_names", "meta", "locations", "npmplus_access_list_ids"];
	}

	static get defaultAllowGraph() {
		return "[owner,access_lists.[clients,items],certificate]";
	}

	static get defaultExpand() {
		return ["owner", "certificate", "access_lists.[clients,items]"];
	}

	static get defaultOrder() {
		return [castJsonIfNeed("domain_names"), "ASC"];
	}

	static get relationMappings() {
		return {
			owner: {
				relation: Model.HasOneRelation,
				modelClass: User,
				join: {
					from: "proxy_host.owner_user_id",
					to: "user.id",
				},
				modify: (qb) => {
					qb.where("user.is_deleted", 0);
				},
			},
			access_lists: {
				relation: Model.ManyToManyRelation,
				modelClass: AccessList,
				join: {
					from: "proxy_host.id",
					through: {
						from: "npmplus_proxy_host_access_list.proxy_host_id",
						to: "npmplus_proxy_host_access_list.access_list_id",
					},
					to: "access_list.id",
				},
				modify: (qb) => {
					qb.where("access_list.is_deleted", 0);
				},
			},
			certificate: {
				relation: Model.HasOneRelation,
				modelClass: Certificate,
				join: {
					from: "proxy_host.certificate_id",
					to: "certificate.id",
				},
				modify: (qb) => {
					qb.where("certificate.is_deleted", 0);
				},
			},
		};
	}
}

export default ProxyHost;
