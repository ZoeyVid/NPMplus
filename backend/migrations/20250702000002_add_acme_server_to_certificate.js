const migrate_name = 'add-acme-server-to-certificate';
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
		.alterTable('certificate', (table) => {
			table.integer('acme_server_id').notNull().unsigned().defaultTo(1);
		})
		.then(() => {
			logger.info('[' + migrate_name + '] certificate Table altered - acme_server_id column added');

			// Add foreign key constraint
			return knex.schema.alterTable('certificate', (table) => {
				table.foreign('acme_server_id').references('id').inTable('acme_server');
			});
		})
		.then(() => {
			logger.info('[' + migrate_name + '] Foreign key constraint added');
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
	
	return knex.schema
		.alterTable('certificate', (table) => {
			table.dropForeign('acme_server_id');
		})
		.then(() => {
			return knex.schema.alterTable('certificate', (table) => {
				table.dropColumn('acme_server_id');
			});
		});
};
