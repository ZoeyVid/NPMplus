// Objection Docs:
// http://vincit.github.io/objection.js/

import { Model } from "objection";
import db from "../db.js";
import { convertBoolFieldsToInt, convertIntFieldsToBool, removeCertificateFields } from "../lib/helpers.js";
import Certificate from "./certificate.js";
import now from "./now_helper.js";
import User from "./user.js";

Model.knex(db());

const boolFields = [
	"ssl_forced",
	"npmplus_http3_support",
	"enabled",
	"hsts_enabled",
	"hsts_subdomains",
	"npmplus_nginx_online",
	"npmplus_mtls_verify_client_optional",
];

class DeadHost extends Model {
	$beforeInsert() {
		this.created_on = now();
		this.modified_on = now();

		// Default for domain_names
		this.domain_names ??= [];

		// Default for meta
		this.meta ??= {};
		this.advanced_config ??= "";
		this.npmplus_nginx_err ??= "";
	}

	$beforeUpdate() {
		this.modified_on = now();
	}

	$parseDatabaseJson(json) {
		const { is_deleted, meta, http2_support, ...thisJson } = super.$parseDatabaseJson(json);
		return convertIntFieldsToBool(thisJson, boolFields);
	}

	$formatDatabaseJson(json) {
		const thisJson = convertBoolFieldsToInt(removeCertificateFields(json), boolFields);
		return super.$formatDatabaseJson(thisJson);
	}

	static get name() {
		return "DeadHost";
	}

	static get tableName() {
		return "dead_host";
	}

	static get jsonAttributes() {
		return ["domain_names", "meta"];
	}

	static get relationMappings() {
		return {
			owner: {
				relation: Model.HasOneRelation,
				modelClass: User,
				join: {
					from: "dead_host.owner_user_id",
					to: "user.id",
				},
			},
			certificate: {
				relation: Model.HasOneRelation,
				modelClass: Certificate,
				join: {
					from: "dead_host.certificate_id",
					to: "certificate.id",
				},
			},
		};
	}
}

export default DeadHost;
