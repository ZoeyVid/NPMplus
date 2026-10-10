// Objection Docs:
// http://vincit.github.io/objection.js/

import { Model } from "objection";
import db from "../db.js";
import { convertBoolFieldsToInt, convertIntFieldsToBool } from "../lib/helpers.js";
import deadHostModel from "./dead_host.js";
import now from "./now_helper.js";
import proxyHostModel from "./proxy_host.js";
import redirectionHostModel from "./redirection_host.js";
import streamModel from "./stream.js";
import userModel from "./user.js";

Model.knex(db());

const boolFields = ["npmplus_reuse_key", "npmplus_dns_challenge"];

class Certificate extends Model {
	$beforeInsert() {
		this.created_on = now();
		this.modified_on = now();

		// Default for expires_on
		this.expires_on ??= now();

		// Default for domain_names
		this.domain_names ??= [];

		// Default for meta
		this.meta ??= {};
		this.npmplus_dns_provider_credentials ??= "";
	}

	$beforeUpdate() {
		this.modified_on = now();
	}

	$parseDatabaseJson(json) {
		const { is_deleted, meta, ...thisJson } = super.$parseDatabaseJson(json);
		return convertIntFieldsToBool(thisJson, boolFields);
	}

	$formatDatabaseJson(json) {
		const thisJson = convertBoolFieldsToInt(json, boolFields);
		return super.$formatDatabaseJson(thisJson);
	}

	static get name() {
		return "Certificate";
	}

	static get tableName() {
		return "certificate";
	}

	static get jsonAttributes() {
		return ["domain_names", "meta"];
	}

	static get relationMappings() {
		return {
			owner: {
				relation: Model.HasOneRelation,
				modelClass: userModel,
				join: {
					from: "certificate.owner_user_id",
					to: "user.id",
				},
			},
			proxy_hosts: {
				relation: Model.HasManyRelation,
				modelClass: proxyHostModel,
				join: {
					from: "certificate.id",
					to: "proxy_host.certificate_id",
				},
			},
			dead_hosts: {
				relation: Model.HasManyRelation,
				modelClass: deadHostModel,
				join: {
					from: "certificate.id",
					to: "dead_host.certificate_id",
				},
			},
			redirection_hosts: {
				relation: Model.HasManyRelation,
				modelClass: redirectionHostModel,
				join: {
					from: "certificate.id",
					to: "redirection_host.certificate_id",
				},
			},
			streams: {
				relation: Model.HasManyRelation,
				modelClass: streamModel,
				join: {
					from: "certificate.id",
					to: "stream.certificate_id",
				},
			},
			mtls_proxy_hosts: {
				relation: Model.HasManyRelation,
				modelClass: proxyHostModel,
				join: {
					from: "certificate.id",
					to: "proxy_host.npmplus_mtls_certificate_id",
				},
			},
			mtls_dead_hosts: {
				relation: Model.HasManyRelation,
				modelClass: deadHostModel,
				join: {
					from: "certificate.id",
					to: "dead_host.npmplus_mtls_certificate_id",
				},
			},
			mtls_redirection_hosts: {
				relation: Model.HasManyRelation,
				modelClass: redirectionHostModel,
				join: {
					from: "certificate.id",
					to: "redirection_host.npmplus_mtls_certificate_id",
				},
			},
			mtls_streams: {
				relation: Model.HasManyRelation,
				modelClass: streamModel,
				join: {
					from: "certificate.id",
					to: "stream.npmplus_mtls_certificate_id",
				},
			},
		};
	}
}

export default Certificate;
