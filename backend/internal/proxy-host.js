import errs from "../lib/error.js";
import { castJsonIfNeed } from "../lib/helpers.js";
import proxyHostModel from "../models/proxy_host.js";
import internalAuditLog from "./audit-log.js";
import internalCertificate from "./certificate.js";
import internalHost from "./host.js";
import internalNginx from "./nginx.js";
import internalProxyHostAccessList from "./proxy-host-access-list.js";

const internalProxyHost = {
	/**
	 * @param   {Access}  access
	 * @param   {Object}  data
	 * @returns {Promise}
	 */
	create: async (access, data) => {
		let thisData = data;
		const createCertificate = thisData.certificate_id === "new";

		if (createCertificate) {
			delete thisData.certificate_id;
		} else if (Number(thisData.certificate_id) > 0) {
			await internalCertificate.get(access, { id: thisData.certificate_id });
		}
		if (Number(thisData.npmplus_mtls_certificate_id) > 0) {
			await internalCertificate.get(access, { id: thisData.npmplus_mtls_certificate_id });
		}

		access.can("proxy_hosts:manage");

		// Get a list of the domain names and check each of them against existing records
		const checkResults = await Promise.all(
			thisData.domain_names.map((domainName) => internalHost.isHostnameTaken(domainName)),
		);
		const taken = checkResults.find((result) => result.is_taken);
		if (taken) {
			throw new errs.ValidationError(`${taken.hostname} is already in use`);
		}

		// At this point the domains should have been checked
		thisData.owner_user_id = access.token.getUserId(1);
		thisData = internalHost.cleanSslHstsData(createCertificate, thisData);
		thisData = internalProxyHostAccessList.cleanAccessListTypes(thisData);
		await internalProxyHostAccessList.validateAccessLists(access, thisData);

		const createdRow = await proxyHostModel.transaction(async (trx) => {
			const insertedRow = await proxyHostModel.query(trx).insertAndFetch(thisData);

			const relationRows = internalProxyHostAccessList.getAccessListRelationRows(insertedRow.id, thisData);
			if (relationRows.length > 0) {
				await trx("npmplus_proxy_host_access_list").insert(relationRows);
			}

			return insertedRow;
		});

		let savedRow;
		try {
			if (createCertificate) {
				// update host with cert id
				await proxyHostModel
					.query()
					.where("id", createdRow.id)
					.patch({ certificate_id: (await internalCertificate.createQuickCertificate(access, thisData)).id });
			}

			const fetchedRow = await internalProxyHost.get(access, {
				id: createdRow.id,
				expand: ["certificate", "access_lists.[clients,items]"],
			});

			const row = await internalProxyHostAccessList.populateLocationAccessLists(
				internalProxyHostAccessList.cleanAccessListTypes(fetchedRow),
			);

			// Configure nginx
			await internalNginx.configure(proxyHostModel, "proxy_host", row);
		} finally {
			savedRow = await internalProxyHost.get(access, { id: createdRow.id });

			// Add to audit log
			await internalAuditLog.add(access, {
				action: "created",
				object_type: "proxy-host",
				object_id: savedRow.id,
				meta: savedRow,
			});
		}

		return savedRow;
	},

	/**
	 * @param  {Access}  access
	 * @param  {Object}  data
	 * @param  {Number}  data.id
	 * @return {Promise}
	 */
	update: async (access, data) => {
		let thisData = data;
		const createCertificate = thisData.certificate_id === "new";

		if (createCertificate) {
			delete thisData.certificate_id;
		} else if (Number(thisData.certificate_id) > 0) {
			await internalCertificate.get(access, { id: thisData.certificate_id });
		}
		if (Number(thisData.npmplus_mtls_certificate_id) > 0) {
			await internalCertificate.get(access, { id: thisData.npmplus_mtls_certificate_id });
		}

		access.can("proxy_hosts:manage");

		const existingRow = await internalProxyHost.get(access, { id: thisData.id });

		// Get a list of the domain names and check each of them against existing records
		if (typeof thisData.domain_names !== "undefined") {
			const checkResults = await Promise.all(
				thisData.domain_names.map((domainName) =>
					internalHost.isHostnameTaken(domainName, "proxy", thisData.id),
				),
			);
			const taken = checkResults.find((result) => result.is_taken);
			if (taken) {
				throw new errs.ValidationError(`${taken.hostname} is already in use`);
			}
		}

		if (existingRow.id !== thisData.id) {
			// Sanity check that something crazy hasn't happened
			throw new errs.InternalValidationError(
				`Proxy Host could not be updated, IDs do not match: ${existingRow.id} !== ${thisData.id}`,
			);
		}

		if (createCertificate) {
			const cert = await internalCertificate.createQuickCertificate(access, {
				...thisData,
				domain_names: thisData.domain_names || existingRow.domain_names,
			});

			// update host with cert id
			thisData.certificate_id = cert.id;
		}

		thisData = internalHost.cleanSslHstsData(createCertificate, thisData, existingRow);
		thisData = internalProxyHostAccessList.cleanAccessListTypes(thisData);
		await internalProxyHostAccessList.validateAccessLists(access, thisData);

		await proxyHostModel.transaction(async (trx) => {
			const patchResult = await proxyHostModel.query(trx).where({ id: thisData.id }).patch(thisData);

			await internalProxyHostAccessList.syncAccessListRelations(trx, thisData.id, thisData);

			return patchResult;
		});

		let savedRow;
		try {
			const fetchedRow = await internalProxyHost.get(access, {
				id: thisData.id,
				expand: ["certificate", "access_lists.[clients,items]"],
			});

			const row = await internalProxyHostAccessList.populateLocationAccessLists(
				internalProxyHostAccessList.cleanAccessListTypes(fetchedRow),
			);

			// No need to add nginx config if host is disabled
			if (row.enabled) {
				// Configure nginx
				await internalNginx.configure(proxyHostModel, "proxy_host", row);
			}
		} finally {
			savedRow = await internalProxyHost.get(access, { id: thisData.id });

			// Add to audit log
			await internalAuditLog.add(access, {
				action: "updated",
				object_type: "proxy-host",
				object_id: savedRow.id,
				meta: savedRow,
			});
		}

		return savedRow;
	},

	/**
	 * @param  {Access}   access
	 * @param  {Object}   data
	 * @param  {Number}   data.id
	 * @param  {Array}    [data.expand]
	 * @return {Promise}
	 */
	get: async (access, data) => {
		const thisData = data || {};

		access.can("proxy_hosts:view");

		const query = proxyHostModel
			.query()
			.where("is_deleted", 0)
			.andWhere("id", thisData.id)
			.allowGraph("[access_lists.[clients,items],certificate]")
			.first();

		if (access.visibility !== "all") {
			query.andWhere("owner_user_id", access.token.getUserId(1));
		}

		if (typeof thisData.expand !== "undefined" && thisData.expand !== null) {
			query.withGraphFetched(`[${thisData.expand.join(", ")}]`);
		}

		const row = await query;
		if (!row?.id) {
			throw new errs.ItemNotFoundError(thisData.id);
		}

		return internalProxyHostAccessList.cleanAccessListTypes(row);
	},

	/**
	 * @param {Access}  access
	 * @param {Object}  data
	 * @param {Number}  data.id
	 * @param {String}  [data.reason]
	 * @returns {Promise}
	 */
	delete: async (access, data) => {
		access.can("proxy_hosts:manage");

		const row = await internalProxyHost.get(access, { id: data.id });
		if (!row?.id) {
			throw new errs.ItemNotFoundError(data.id);
		}

		await proxyHostModel.transaction((trx) =>
			proxyHostModel.query(trx).where("id", row.id).patch({
				is_deleted: 1,
			}),
		);

		try {
			// Delete Nginx Config
			await internalNginx.deleteConfig("proxy_host", row);

			await internalProxyHostAccessList.delete(row);
			await internalNginx.reload();
		} finally {
			// Add to audit log
			await internalAuditLog.add(access, {
				action: "deleted",
				object_type: "proxy-host",
				object_id: row.id,
				meta: row,
			});
		}

		return row;
	},

	/**
	 * @param {Access}  access
	 * @param {Object}  data
	 * @param {Number}  data.id
	 * @param {String}  [data.reason]
	 * @returns {Promise}
	 */
	enable: async (access, data) => {
		access.can("proxy_hosts:manage");

		const row = await internalProxyHost.get(access, {
			id: data.id,
			expand: ["certificate", "access_lists.[clients,items]"],
		});
		if (!row?.id) {
			throw new errs.ItemNotFoundError(data.id);
		}
		if (row.enabled) {
			throw new errs.ValidationError("Host is already enabled");
		}

		const checkResults = await Promise.all(
			row.domain_names.map((domainName) => internalHost.isHostnameTaken(domainName)),
		);
		const taken = checkResults.find((result) => result.is_taken);
		if (taken) {
			throw new errs.ValidationError(`${taken.hostname} is already in use by an active host`);
		}

		row.enabled = 1;

		await proxyHostModel.query().where("id", row.id).patch({
			enabled: 1,
		});

		let savedRow;
		try {
			// Configure nginx
			await internalNginx.configure(
				proxyHostModel,
				"proxy_host",
				await internalProxyHostAccessList.populateLocationAccessLists(
					internalProxyHostAccessList.cleanAccessListTypes(row),
				),
			);
		} finally {
			savedRow = await internalProxyHost.get(access, { id: row.id });

			// Add to audit log
			await internalAuditLog.add(access, {
				action: "enabled",
				object_type: "proxy-host",
				object_id: row.id,
				meta: savedRow,
			});
		}

		return savedRow;
	},

	/**
	 * @param {Access}  access
	 * @param {Object}  data
	 * @param {Number}  data.id
	 * @param {String}  [data.reason]
	 * @returns {Promise}
	 */
	disable: async (access, data) => {
		access.can("proxy_hosts:manage");

		const row = await internalProxyHost.get(access, { id: data.id });
		if (!row?.id) {
			throw new errs.ItemNotFoundError(data.id);
		}
		if (!row.enabled) {
			throw new errs.ValidationError("Host is already disabled");
		}

		row.enabled = 0;

		await proxyHostModel.query().where("id", row.id).patch({
			enabled: 0,
		});

		let savedRow;
		try {
			// Delete Nginx Config
			await internalNginx.deleteConfig("proxy_host", row);
			await internalNginx.reload();
		} finally {
			savedRow = await internalProxyHost.get(access, { id: row.id });

			// Add to audit log
			await internalAuditLog.add(access, {
				action: "disabled",
				object_type: "proxy-host",
				object_id: row.id,
				meta: savedRow,
			});
		}

		return savedRow;
	},

	/**
	 * All Hosts
	 *
	 * @param   {Access}  access
	 * @param   {Array}   [expand]
	 * @param   {String}  [searchQuery]
	 * @returns {Promise}
	 */
	getAll: async (access, expand, searchQuery) => {
		access.can("proxy_hosts:view");

		const query = proxyHostModel
			.query()
			.where("is_deleted", 0)
			.groupBy("id")
			.allowGraph("[owner,access_lists,certificate]")
			.orderBy(castJsonIfNeed("domain_names"), "ASC");

		if (access.visibility !== "all") {
			query.andWhere("owner_user_id", access.token.getUserId(1));
		}

		// Query is used for searching
		if (typeof searchQuery === "string" && searchQuery.length > 0) {
			query.where(function () {
				this.where(castJsonIfNeed("domain_names"), "like", `%${searchQuery}%`);
			});
		}

		if (typeof expand !== "undefined" && expand !== null) {
			query.withGraphFetched(`[${expand.join(", ")}]`);
		}

		return (await query).map((row) => internalProxyHostAccessList.cleanAccessListTypes(row));
	},

	/**
	 * Report use
	 *
	 * @param   {Number}  user_id
	 * @param   {String}  visibility
	 * @returns {Promise}
	 */
	getCount: async (user_id, visibility) => {
		const query = proxyHostModel.query().count("id as count").where("is_deleted", 0);

		if (visibility !== "all") {
			query.andWhere("owner_user_id", user_id);
		}

		const row = await query.first();

		return Number.parseInt(row.count, 10);
	},
};

export default internalProxyHost;
