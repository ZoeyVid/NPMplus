const migrate_name = 'acme-servers';
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
		.createTable('acme_server', (table) => {
			table.increments().primary();
			table.dateTime('created_on').notNull();
			table.dateTime('modified_on').notNull();
			table.integer('owner_user_id').notNull().unsigned();
			table.integer('is_deleted').notNull().unsigned().defaultTo(0);
			table.integer('is_default').notNull().unsigned().defaultTo(0);
			table.string('name', 100).notNull();
			table.string('description', 255).notNull().defaultTo('');
			table.string('server_url', 500).notNull();
			table.string('email', 255).notNull().defaultTo('');
			table.string('eab_kid', 255).notNull().defaultTo('');
			table.string('eab_hmac_key', 500).notNull().defaultTo('');
			table.string('profile', 50).notNull().defaultTo('none');
			table.string('key_type', 20).notNull().defaultTo('ecdsa');
			table.integer('must_staple').notNull().unsigned().defaultTo(0);
			table.integer('ocsp_stapling').notNull().unsigned().defaultTo(0);
			table.integer('tls_verify').notNull().unsigned().defaultTo(1);
			table.json('meta').notNull().defaultTo('{}');
		})
		.then(() => {
			logger.info('[' + migrate_name + '] acme_server Table created');

			// Create default Let's Encrypt server from environment
			const defaultEmail = process.env.ACME_EMAIL || '';
			const defaultServer = process.env.ACME_SERVER || 'https://acme-v02.api.letsencrypt.org/directory';
			const defaultProfile = process.env.ACME_PROFILE || 'none';
			const defaultKeyType = process.env.ACME_KEY_TYPE || 'ecdsa';
			const defaultMustStaple = process.env.ACME_MUST_STAPLE === 'true' ? 1 : 0;
			const defaultOcspStapling = process.env.ACME_OCSP_STAPLING === 'true' ? 1 : 0;
			const defaultTlsVerify = process.env.ACME_SERVER_TLS_VERIFY === 'false' ? 0 : 1;
			const defaultEabKid = process.env.ACME_EAB_KID || '';
			const defaultEabHmacKey = process.env.ACME_EAB_HMAC_KEY || '';

			return knex('acme_server').insert({
				created_on: knex.fn.now(),
				modified_on: knex.fn.now(),
				owner_user_id: 1, // Admin user
				is_default: 1,
				name: 'Let\'s Encrypt',
				description: 'Default Let\'s Encrypt ACME server (migrated from environment)',
				server_url: defaultServer,
				email: defaultEmail,
				eab_kid: defaultEabKid,
				eab_hmac_key: defaultEabHmacKey,
				profile: defaultProfile,
				key_type: defaultKeyType,
				must_staple: defaultMustStaple,
				ocsp_stapling: defaultOcspStapling,
				tls_verify: defaultTlsVerify,
				meta: JSON.stringify({})
			});
		})
		.then(() => {
			logger.info('[' + migrate_name + '] Default ACME server created from environment variables');
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
	return knex.schema.dropTable('acme_server');
};
