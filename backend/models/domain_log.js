// Objection Docs:
// http://vincit.github.io/objection.js/

const db = require('../db');
const Model = require('objection').Model;
const now = require('./now_helper');

Model.knex(db);

class DomainLog extends Model {
	static get name() {
		return 'DomainLog';
	}

	static get tableName() {
		return 'domain_logs';
	}

	static get jsonAttributes() {
		return ['meta'];
	}

	static get relationMappings() {
		const ProxyHost = require('./proxy_host');
		
		return {
			proxy_host: {
				relation: Model.BelongsToOneRelation,
				modelClass: ProxyHost,
				join: {
					from: 'domain_logs.proxy_host_id',
					to: 'proxy_host.id'
				}
			}
		};
	}

	static getLogPath(proxyHostId, logType = 'access') {
		return `/data/logs/proxy-host-${proxyHostId}/${logType}.log`;
	}

	static getLogArchivePath(proxyHostId, logType = 'access', date) {
		return `/data/logs/proxy-host-${proxyHostId}/${logType}-${date}.log`;
	}
}

module.exports = DomainLog;
