const migrate_name = 'initial-schema';
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
		.createTable('auth', (table) => {
			table.increments().primary();
			table.dateTime('created_on').notNull();
			table.dateTime('modified_on').notNull();
			table.integer('user_id').notNull().unsigned();
			table.string('type', 30).notNull();
			table.string('secret').notNull();
			table.json('meta').notNull();
			table.integer('is_deleted').notNull().unsigned().defaultTo(0);
		})
		.then(() => {
			logger.info('[' + migrate_name + '] auth Table created');

			return knex.schema.createTable('user', (table) => {
				table.increments().primary();
				table.dateTime('created_on').notNull();
				table.dateTime('modified_on').notNull();
				table.integer('is_deleted').notNull().unsigned().defaultTo(0);
				table.integer('is_disabled').notNull().unsigned().defaultTo(0);
				table.string('email').notNull();
				table.string('name').notNull();
				table.string('nickname').notNull();
				table.string('avatar').notNull();
				table.json('roles').notNull();
			});
		})
		.then(() => {
			logger.info('[' + migrate_name + '] user Table created');

			return knex.schema.createTable('user_permission', (table) => {
				table.increments().primary();
				table.dateTime('created_on').notNull();
				table.dateTime('modified_on').notNull();
				table.integer('user_id').notNull().unsigned();
				table.string('visibility').notNull();
				table.string('proxy_hosts').notNull();
				table.string('redirection_hosts').notNull();
				table.string('dead_hosts').notNull();
				table.string('streams').notNull();
				table.string('access_lists').notNull();
				table.string('certificates').notNull();
				table.string('acme_servers').notNull().defaultTo('manage');
				table.unique('user_id');
			});
		})
		.then(() => {
			logger.info('[' + migrate_name + '] user_permission Table created');

			return knex.schema.createTable('proxy_host', (table) => {
				table.increments().primary();
				table.dateTime('created_on').notNull();
				table.dateTime('modified_on').notNull();
				table.integer('owner_user_id').notNull().unsigned();
				table.integer('is_deleted').notNull().unsigned().defaultTo(0);
				table.json('domain_names').notNull();
				table.string('forward_ip').notNull();
				table.integer('forward_port').notNull().unsigned();
				table.integer('access_list_id').notNull().unsigned().defaultTo(0);
				table.integer('certificate_id').notNull().unsigned().defaultTo(0);
				table.integer('ssl_forced').notNull().unsigned().defaultTo(0);
				table.integer('caching_enabled').notNull().unsigned().defaultTo(0);
				table.integer('block_exploits').notNull().unsigned().defaultTo(0);
				table.text('advanced_config').notNull().defaultTo('');
				table.json('meta').notNull();
			});
		})
		.then(() => {
			logger.info('[' + migrate_name + '] proxy_host Table created');

			return knex.schema.createTable('redirection_host', (table) => {
				table.increments().primary();
				table.dateTime('created_on').notNull();
				table.dateTime('modified_on').notNull();
				table.integer('owner_user_id').notNull().unsigned();
				table.integer('is_deleted').notNull().unsigned().defaultTo(0);
				table.json('domain_names').notNull();
				table.string('forward_domain_name').notNull();
				table.integer('preserve_path').notNull().unsigned().defaultTo(0);
				table.integer('certificate_id').notNull().unsigned().defaultTo(0);
				table.integer('ssl_forced').notNull().unsigned().defaultTo(0);
				table.integer('block_exploits').notNull().unsigned().defaultTo(0);
				table.text('advanced_config').notNull().defaultTo('');
				table.json('meta').notNull();
			});
		})
		.then(() => {
			logger.info('[' + migrate_name + '] redirection_host Table created');

			return knex.schema.createTable('dead_host', (table) => {
				table.increments().primary();
				table.dateTime('created_on').notNull();
				table.dateTime('modified_on').notNull();
				table.integer('owner_user_id').notNull().unsigned();
				table.integer('is_deleted').notNull().unsigned().defaultTo(0);
				table.json('domain_names').notNull();
				table.integer('certificate_id').notNull().unsigned().defaultTo(0);
				table.integer('ssl_forced').notNull().unsigned().defaultTo(0);
				table.text('advanced_config').notNull().defaultTo('');
				table.json('meta').notNull();
			});
		})
		.then(() => {
			logger.info('[' + migrate_name + '] dead_host Table created');

			return knex.schema.createTable('stream', (table) => {
				table.increments().primary();
				table.dateTime('created_on').notNull();
				table.dateTime('modified_on').notNull();
				table.integer('owner_user_id').notNull().unsigned();
				table.integer('is_deleted').notNull().unsigned().defaultTo(0);
				table.integer('incoming_port').notNull().unsigned();
				table.string('forward_ip').notNull();
				table.integer('forwarding_port').notNull().unsigned();
				table.integer('tcp_forwarding').notNull().unsigned().defaultTo(0);
				table.integer('udp_forwarding').notNull().unsigned().defaultTo(0);
				table.json('meta').notNull();
			});
		})
		.then(() => {
			logger.info('[' + migrate_name + '] stream Table created');

			return knex.schema.createTable('access_list', (table) => {
				table.increments().primary();
				table.dateTime('created_on').notNull();
				table.dateTime('modified_on').notNull();
				table.integer('owner_user_id').notNull().unsigned();
				table.integer('is_deleted').notNull().unsigned().defaultTo(0);
				table.string('name').notNull();
				table.json('meta').notNull();
			});
		})
		.then(() => {
			logger.info('[' + migrate_name + '] access_list Table created');

			return knex.schema.createTable('certificate', (table) => {
				table.increments().primary();
				table.dateTime('created_on').notNull();
				table.dateTime('modified_on').notNull();
				table.integer('owner_user_id').notNull().unsigned();
				table.integer('is_deleted').notNull().unsigned().defaultTo(0);
				table.string('certificate_type').notNull().defaultTo('acme');
				table.string('nice_name').notNull().defaultTo('');
				table.json('domain_names').notNull();
				table.dateTime('expires_on').notNull();
				table.json('meta').notNull();
			});
		})
		.then(() => {
			logger.info('[' + migrate_name + '] certificate Table created');

			return knex.schema.createTable('access_list_auth', (table) => {
				table.increments().primary();
				table.dateTime('created_on').notNull();
				table.dateTime('modified_on').notNull();
				table.integer('access_list_id').notNull().unsigned();
				table.string('username').notNull();
				table.string('password').notNull();
				table.json('meta').notNull();
			});
		})
		.then(() => {
			logger.info('[' + migrate_name + '] access_list_auth Table created');

			return knex.schema.createTable('audit_log', (table) => {
				table.increments().primary();
				table.dateTime('created_on').notNull();
				table.dateTime('modified_on').notNull();
				table.integer('user_id').notNull().unsigned();
				table.string('object_type').notNull().defaultTo('');
				table.integer('object_id').notNull().unsigned().defaultTo(0);
				table.string('action').notNull();
				table.json('meta').notNull();
			});
		})
		.then(() => {
			logger.info('[' + migrate_name + '] audit_log Table created');

			return knex.schema.createTable('acme_server', (table) => {
				table.increments().primary();
				table.dateTime('created_on').notNull();
				table.dateTime('modified_on').notNull();
				table.integer('owner_user_id').notNull().unsigned();
				table.integer('is_deleted').notNull().unsigned().defaultTo(0);
				table.string('name').notNull();
				table.string('description').defaultTo('');
				table.string('server_url').notNull();
				table.string('email').defaultTo('');
				table.string('key_type').notNull().defaultTo('rsa');
				table.string('profile').defaultTo('none');
				table.string('eab_kid').defaultTo('');
				table.string('eab_hmac_key').defaultTo('');
				table.boolean('must_staple').notNull().defaultTo(false);
				table.boolean('ocsp_stapling').notNull().defaultTo(false);
				table.boolean('tls_verify').notNull().defaultTo(true);
				table.json('meta').notNull();
				table.unique(['owner_user_id', 'name']);
			});
		})
		.then(() => {
			logger.info('[' + migrate_name + '] acme_server Table created');

			// Add acme_server_id column to certificate table
			return knex.schema.alterTable('certificate', (table) => {
				table.integer('acme_server_id').unsigned();
			});
		})
		.then(() => {
			logger.info('[' + migrate_name + '] certificate Table altered - acme_server_id column added');

			// Create initial ACME server
			const defaultAcmeServer = {
				created_on: knex.fn.now(),
				modified_on: knex.fn.now(),
				owner_user_id: 1,
				is_deleted: 0,
				name: process.env.ACME_SERVER_NAME || "Let's Encrypt",
				description: process.env.ACME_SERVER_DESCRIPTION || "Let's Encrypt ACME Server",
				server_url: process.env.ACME_SERVER_URL || 'https://acme-v02.api.letsencrypt.org/directory',
				email: process.env.ACME_EMAIL || '',
				key_type: process.env.ACME_KEY_TYPE || 'rsa',
				profile: process.env.ACME_PROFILE || 'none',
				eab_kid: process.env.ACME_EAB_KID || '',
				eab_hmac_key: process.env.ACME_HMAC_KEY || '',
				must_staple: false,
				ocsp_stapling: false,
				tls_verify: true,
				meta: JSON.stringify({
					ca_bundle: process.env.ACME_CA_BUNDLE || '',
					skip_challenge_verify: process.env.ACME_SKIP_CHALLENGE_VERIFY === 'true',
				}),
			};

			return knex('acme_server').insert(defaultAcmeServer);
		})
		.then(() => {
			logger.info('[' + migrate_name + '] Initial ACME server created from environment variables');

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
exports.down = function (knex, Promise) {
	logger.warn('[' + migrate_name + "] You can't migrate down the initial data.");
	return Promise.resolve(true);
};
