const migrate_name = 'add-acme-servers-permission';
const logger = require('../logger').migrate;

/**
 * Migrate
 *
 * @see http://knexjs.org/#Schema
 *
 * @param   {Object}  knex
 * @param   {Promise} Promise
 * @returns {Promise}
 */
exports.up = function (knex /*, Promise */) {
	logger.info('[' + migrate_name + '] Migrating Up...');

	return knex.schema
		.alterTable('user_permission', (table) => {
			table.string('acme_servers', 10).notNull().defaultTo('hidden');
		})
		.then(() => {
			logger.info('[' + migrate_name + '] user_permission Table altered - acme_servers column added');

			// Set default permissions for existing users
			return knex('user_permission').update({
				acme_servers: 'manage'
			});
		})
		.then(() => {
			logger.info('[' + migrate_name + '] Default ACME servers permissions set');
		});
};

/**
 * Undo Migrate
 *
 * @param   {Object}  knex
 * @param   {Promise} Promise
 * @returns {Promise}
 */
exports.down = function (knex /*, Promise */) {
	logger.info('[' + migrate_name + '] Migrating Down...');
	
	return knex.schema.alterTable('user_permission', (table) => {
		table.dropColumn('acme_servers');
	});
};
