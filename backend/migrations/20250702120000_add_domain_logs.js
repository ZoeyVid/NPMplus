const migrate_name = 'add_domain_logs';
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
			table.boolean('enable_logs').notNull().defaultTo(true);
			table.string('log_format', 50).notNull().defaultTo('combined');
			table.integer('log_retention_days').notNull().defaultTo(30);
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
			table.dropColumn('enable_logs');
			table.dropColumn('log_format');
			table.dropColumn('log_retention_days');
		});
};

exports.config = { transaction: true };
