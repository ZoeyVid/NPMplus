const migrate_name = 'add_default_page_to_proxy_host';
const logger = require('../logger').migrate;

/**
 * Migrate
 *
 * @see http://knexjs.org/#Schema
 *
 * @param   {Object} knex
 * @returns {Promise}
 */
exports.up = function (knex) {
	logger.info('[' + migrate_name + '] Migrating Up...');

	return knex.schema
		.table('proxy_host', function (table) {
			table.boolean('use_default_page').notNull().defaultTo(false).comment('Enable default page when backend is unavailable');
		})
		.then(() => {
			logger.info('[' + migrate_name + '] proxy_host Table altered');
		});
};

/**
 * Undo Migrate
 *
 * @param   {Object} knex
 * @returns {Promise}
 */
exports.down = function (knex) {
	logger.info('[' + migrate_name + '] Migrating Down...');

	return knex.schema
		.table('proxy_host', function (table) {
			table.dropColumn('use_default_page');
		})
		.then(() => {
			logger.info('[' + migrate_name + '] proxy_host Table rolled back');
		});
};
