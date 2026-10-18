import errs from "../lib/error.js";
import { castJsonIfNeed } from "../lib/helpers.js";
import deadHostModel from "../models/dead_host.js";
import internalAuditLog from "./audit-log.js";
import internalCertificate from "./certificate.js";
import internalHost from "./host.js";
import internalNginx from "./nginx.js";

const internalDeadHost = {
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
		} else if (thisData.certificate_id > 0) {
			await internalCertificate.get(access, { id: thisData.certificate_id });
		}
		if (thisData.npmplus_mtls_certificate_id > 0) {
			await internalCertificate.get(access, { id: thisData.npmplus_mtls_certificate_id });
		}

		access.can("dead_hosts:manage");

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

		if (createCertificate) {
			thisData.certificate_id = (await internalCertificate.createQuickCertificate(access, thisData)).id;
		}

		const createdRow = await deadHostModel.query().insertAndFetch(thisData);

		let savedRow;
		try {
			const row = await internalDeadHost.get(access, {
				id: createdRow.id,
				expand: ["certificate"],
			});

			// Configure nginx
			await internalNginx.configure(deadHostModel, "dead_host", row);
		} finally {
			savedRow = await internalDeadHost.get(access, { id: createdRow.id });

			// Add to audit log
			await internalAuditLog.add(access, {
				action: "created",
				object_type: "dead-host",
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
		} else if (thisData.certificate_id > 0) {
			await internalCertificate.get(access, { id: thisData.certificate_id });
		}
		if (thisData.npmplus_mtls_certificate_id > 0) {
			await internalCertificate.get(access, { id: thisData.npmplus_mtls_certificate_id });
		}

		access.can("dead_hosts:manage");

		const existingRow = await internalDeadHost.get(access, { id: thisData.id });

		// Get a list of the domain names and check each of them against existing records
		if (thisData.domain_names !== undefined) {
			const checkResults = await Promise.all(
				thisData.domain_names.map((domainName) =>
					internalHost.isHostnameTaken(domainName, "dead", thisData.id),
				),
			);
			const taken = checkResults.find((result) => result.is_taken);
			if (taken) {
				throw new errs.ValidationError(`${taken.hostname} is already in use`);
			}
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

		await deadHostModel.query().where({ id: thisData.id }).patch(thisData);

		let savedRow;
		try {
			const row = await internalDeadHost.get(access, {
				id: thisData.id,
				expand: ["certificate"],
			});

			// Configure nginx
			await internalNginx.configure(deadHostModel, "dead_host", row);
		} finally {
			savedRow = await internalDeadHost.get(access, { id: thisData.id });

			// Add to audit log
			await internalAuditLog.add(access, {
				action: "updated",
				object_type: "dead-host",
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
		access.can("dead_hosts:view");

		const query = deadHostModel.query().where("id", data.id).allowGraph("[certificate]").first();

		if (access.visibility !== "all") {
			query.andWhere("owner_user_id", access.token.getUserId(1));
		}

		if (data.expand) query.withGraphFetched(`[${data.expand.join(", ")}]`);

		const row = await query;
		if (!row?.id) {
			throw new errs.ItemNotFoundError(data.id);
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
	delete: async (access, data) => {
		access.can("dead_hosts:manage");

		const row = await internalDeadHost.get(access, { id: data.id });

		await deadHostModel.query().deleteById(row.id);

		try {
			// Delete Nginx Config
			await internalNginx.deleteConfig("dead_host", row);
			await internalNginx.reload();
		} finally {
			// Add to audit log
			await internalAuditLog.add(access, {
				action: "deleted",
				object_type: "dead-host",
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
		access.can("dead_hosts:manage");

		const row = await internalDeadHost.get(access, {
			id: data.id,
			expand: ["certificate"],
		});
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

		await deadHostModel.query().where("id", row.id).patch({
			enabled: 1,
		});

		let savedRow;
		try {
			// Configure nginx
			await internalNginx.configure(deadHostModel, "dead_host", row);
		} finally {
			savedRow = await internalDeadHost.get(access, { id: row.id });

			// Add to audit log
			await internalAuditLog.add(access, {
				action: "enabled",
				object_type: "dead-host",
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
		access.can("dead_hosts:manage");

		const row = await internalDeadHost.get(access, { id: data.id });
		if (!row.enabled) {
			throw new errs.ValidationError("Host is already disabled");
		}

		await deadHostModel.query().where("id", row.id).patch({
			enabled: 0,
		});

		let savedRow;
		try {
			// Delete Nginx Config
			await internalNginx.deleteConfig("dead_host", row);
			await internalNginx.reload();
		} finally {
			savedRow = await internalDeadHost.get(access, { id: row.id });

			// Add to audit log
			await internalAuditLog.add(access, {
				action: "disabled",
				object_type: "dead-host",
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
	getAll: (access, expand, searchQuery) => {
		access.can("dead_hosts:view");

		const query = deadHostModel
			.query()
			.groupBy("id")
			.allowGraph("[owner,certificate]")
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

		if (expand) query.withGraphFetched(`[${expand.join(", ")}]`);

		return query;
	},

	/**
	 * Report use
	 *
	 * @param   {Number}  user_id
	 * @param   {String}  visibility
	 * @returns {Promise}
	 */
	getCount: (user_id, visibility) => {
		const query = deadHostModel.query();

		if (visibility !== "all") {
			query.andWhere("owner_user_id", user_id);
		}

		return query.resultSize();
	},
};

export default internalDeadHost;
