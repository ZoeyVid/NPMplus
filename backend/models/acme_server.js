// Objection Docs:
// http://vincit.github.io/objection.js/

const db = require('../db');
const helpers = require('../lib/helpers');
const Model = require('objection').Model;
const now = require('./now_helper');

Model.knex(db);

const boolFields = ['is_deleted', 'must_staple', 'ocsp_stapling', 'tls_verify'];

class AcmeServer extends Model {
	$beforeInsert() {
		this.created_on = now();
		this.modified_on = now();

		// Default for meta
		if (typeof this.meta === 'undefined') {
			this.meta = {};
		}
	}

	$beforeUpdate() {
		this.modified_on = now();
	}

	$parseDatabaseJson(json) {
		json = super.$parseDatabaseJson(json);
		return helpers.convertIntFieldsToBool(json, boolFields);
	}

	$formatDatabaseJson(json) {
		json = helpers.convertBoolFieldsToInt(json, boolFields);
		return super.$formatDatabaseJson(json);
	}

	static get name() {
		return 'AcmeServer';
	}

	static get tableName() {
		return 'acme_server';
	}

	static get jsonAttributes() {
		return ['meta'];
	}

	static get relationMappings() {
		const Certificate = require('./certificate');
		const User = require('./user');

		return {
			owner: {
				relation: Model.HasOneRelation,
				modelClass: User,
				join: {
					from: 'acme_server.owner_user_id',
					to: 'user.id',
				},
				modify: function (qb) {
					qb.where('user.is_deleted', 0);
				},
			},
			certificates: {
				relation: Model.HasManyRelation,
				modelClass: Certificate,
				join: {
					from: 'acme_server.id',
					to: 'certificate.acme_server_id',
				},
				modify: function (qb) {
					qb.where('certificate.is_deleted', 0);
				},
			},
		};
	}

	/**
	 * Get ACME server configuration for certbot
	 * @returns {Object}
	 */
	getCertbotConfig() {
		const config = {
			server: this.server_url,
			email: this.email || undefined,
			profile: this.profile !== 'none' ? this.profile : undefined,
			keyType: this.key_type,
			mustStaple: this.must_staple,
			ocspStapling: this.ocsp_stapling,
			tlsVerify: this.tls_verify,
			eabKid: this.eab_kid || undefined,
			eabHmacKey: this.eab_hmac_key || undefined,
		};

		// Remove undefined values
		return Object.fromEntries(
			Object.entries(config).filter(([, value]) => value !== undefined)
		);
	}
}

module.exports = AcmeServer;
