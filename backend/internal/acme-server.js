const _ = require('lodash');
const error = require('../lib/error');
const acmeServerModel = require('../models/acme_server');
const userModel = require('../models/user');

function omissions() {
	return ['is_deleted', 'owner.is_deleted'];
}

const internalAcmeServer = {
	/**
	 * Create a new ACME server
	 *
	 * @param  {Access}  access
	 * @param  {Object}  data
	 * @returns {Promise}
	 */
	create: (access, data) => {
		return access
			.can('acme_servers:create', data)
			.then(() => {
				data.owner_user_id = access.token.getUserId(1);

				// Validate required fields
				if (!data.name || !data.server_url) {
					throw new error.ValidationError('Name and Server URL are required');
				}

				// Validate server URL format
				if (!data.server_url.match(/^https?:\/\/.+/)) {
					throw new error.ValidationError('Server URL must be a valid HTTP/HTTPS URL');
				}

				return acmeServerModel.query().insertAndFetch(data);
			})
			.then((server) => {
				return internalAcmeServer.get(access, { id: server.id, expand: ['owner'] });
			});
	},

	/**
	 * Update an ACME server
	 *
	 * @param  {Access}  access
	 * @param  {Object}  data
	 * @returns {Promise}
	 */
	update: (access, data) => {
		return access
			.can('acme_servers:update', data.id)
			.then(() => {
				return internalAcmeServer.get(access, { id: data.id });
			})
			.then((row) => {
				if (row.id !== data.id) {
					throw new error.InternalValidationError('ACME Server could not be updated, IDs do not match: ' + row.id + ' !== ' + data.id);
				}

				// Validate server URL format if changed
				if (data.server_url && !data.server_url.match(/^https?:\/\/.+/)) {
					throw new error.ValidationError('Server URL must be a valid HTTP/HTTPS URL');
				}

				return acmeServerModel.query().where({ id: data.id }).patch(data);
			})
			.then(() => {
				return internalAcmeServer.get(access, { id: data.id, expand: ['owner'] });
			});
	},

	/**
	 * Get an ACME server
	 *
	 * @param  {Access}  access
	 * @param  {Object}  data
	 * @param  {Number}  data.id
	 * @param  {Array}   [data.expand]
	 * @returns {Promise}
	 */
	get: (access, data) => {
		return access
			.can('acme_servers:get', data.id)
			.then(() => {
				let query = acmeServerModel
					.query()
					.where('acme_server.id', data.id)
					.where('acme_server.is_deleted', 0)
					.allowGraph('[owner]')
					.first();

				if (typeof data.expand !== 'undefined' && data.expand !== null) {
					// Convert expand to array if it's a string
					let expandArray = Array.isArray(data.expand) ? data.expand : [data.expand];
					query.withGraphFetched(`[${expandArray.join(', ')}]`);
				}

				return query;
			})
			.then((row) => {
				if (!row) {
					throw new error.ItemNotFoundError(data.id);
				}
				// Remove password from owner
				if (row.owner) {
					delete row.owner.password;
				}

				return _.omit(row, omissions());
			});
	},

	/**
	 * Get all ACME servers
	 *
	 * @param  {Access}  access
	 * @param  {Array}   [expand]
	 * @param  {String}  [search]
	 * @returns {Promise}
	 */
	getAll: (access, expand, search) => {
		return access
			.can('acme_servers:list')
			.then((access_data) => {
				let query = acmeServerModel
					.query()
					.where('is_deleted', 0)
					.allowGraph('[owner]')
					.orderBy('name', 'ASC');

				if (typeof expand !== 'undefined' && expand !== null) {
					// Convert expand to array if it's a string
					let expandArray = Array.isArray(expand) ? expand : [expand];
					query.withGraphFetched(`[${expandArray.join(', ')}]`);
				}

				// All users can see their own ACME servers
				if (access_data.permission_visibility !== 'all') {
					query.where('owner_user_id', access.token.getUserId(1));
				}

				if (typeof search === 'string') {
					query.where(function () {
						this.where('name', 'like', '%' + search + '%').orWhere('description', 'like', '%' + search + '%').orWhere('server_url', 'like', '%' + search + '%');
					});
				}

				return query;
			})
			.then((rows) => {
				if (typeof expand !== 'undefined' && expand !== null) {
					// Convert expand to array if it's a string
					let expandArray = Array.isArray(expand) ? expand : [expand];
					if (expandArray.indexOf('owner') !== -1) {
						rows.map(function (row) {
							if (row.owner) {
								delete row.owner.password;
							}
							return row;
						});
					}
				}

				return rows.map((row) => _.omit(row, omissions()));
			});
	},

	/**
	 * Report on ACME servers
	 *
	 * @param  {Access}  access
	 * @returns {Promise}
	 */
	getCount: (access) => {
		return access
			.can('acme_servers:list')
			.then(() => {
				return acmeServerModel
					.query()
					.count('id as count')
					.where('is_deleted', 0)
					.first();
			})
			.then((row) => {
				return parseInt(row.count, 10);
			});
	},

	/**
	 * Delete an ACME server
	 *
	 * @param  {Access}  access
	 * @param  {Object}  data
	 * @param  {Number}  data.id
	 * @returns {Promise}
	 */
	delete: (access, data) => {
		return access
			.can('acme_servers:delete', data.id)
			.then(() => {
				return internalAcmeServer.get(access, { id: data.id });
			})
			.then((row) => {
				if (!row) {
					throw new error.ItemNotFoundError(data.id);
				}

				// Don't allow deleting the default server if it's the only one
				if (row.is_default) {
					return acmeServerModel
						.query()
						.count('id as count')
						.where('is_deleted', 0)
						.whereNot('id', data.id)
						.first()
						.then((countRow) => {
							if (parseInt(countRow.count, 10) === 0) {
								throw new error.ValidationError('Cannot delete the last ACME server');
							}
						});
				}
			})
			.then(() => {
				// Check if any certificates are using this server
				return acmeServerModel
					.query()
					.findById(data.id)
					.withGraphFetched('certificates')
					.first();
			})
			.then((server) => {
				if (server.certificates && server.certificates.length > 0) {
					throw new error.ValidationError('Cannot delete ACME server that is in use by certificates');
				}

				return acmeServerModel
					.query()
					.where({ id: data.id })
					.patch({ is_deleted: 1 });
			})
			.then(() => {
				return true;
			});
	},

	/**
	 * Get the first available ACME server (replacement for default server)
	 *
	 * @param  {Access}  access
	 * @returns {Promise}
	 */
	getFirstAvailableServer: (access) => {
		return access
			.can('acme_servers:list')
			.then((access_data) => {
				let query = acmeServerModel.query().where('is_deleted', 0).orderBy('name', 'ASC').first();

				// All users can see their own ACME servers
				if (access_data.permission_visibility !== 'all') {
					query.where('owner_user_id', access.token.getUserId(1));
				}

				return query;
			})
			.then((server) => {
				if (!server) {
					throw new error.ItemNotFoundError('No ACME servers available');
				}
				return server;
			});
	},
};

module.exports = internalAcmeServer;
