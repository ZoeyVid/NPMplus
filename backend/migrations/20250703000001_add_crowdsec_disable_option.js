const migrate_name = 'add_crowdsec_disable_option';
const logger = require('../logger').migrate;

/**
 * Migrate
 *
 * @see http://knexjs.org/#Schema
 *
 * @param   {Object} knex
 * @param   {Promise} Promise
 * @returns {Promise}
 */
exports.up = function (knex /*, Promise */) {
	logger.info('[' + migrate_name + '] Migrating Up...');

	return knex.schema
		.table('proxy_host', function (table) {
			table.boolean('crowdsec_disabled').notNull().defaultTo(false);
		})
		.then(function () {
			logger.info('[' + migrate_name + '] proxy_host Table altered');
		});
};

/**
 * Undo Migrate
 *
 * @param   {Object} knex
 * @param   {Promise} Promise
 * @returns {Promise}
 */
exports.down = function (knex /*, Promise */) {
	logger.info('[' + migrate_name + '] Migrating Down...');
	return knex.schema
		.table('proxy_host', function (table) {
			table.dropColumn('crowdsec_disabled');
		});
};

exports.config = { transaction: true };
