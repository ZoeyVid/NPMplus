import _ from "lodash";
import errs from "../lib/error.js";
import { castJsonIfNeed } from "../lib/helpers.js";
import utils from "../lib/utils.js";
import redirectionHostModel from "../models/redirection_host.js";
import internalAuditLog from "./audit-log.js";
import internalCertificate from "./certificate.js";
import internalHost from "./host.js";
import internalNginx from "./nginx.js";

const omissions = () => ["is_deleted"];

const internalRedirectionHost = {
	/**
	 * @param   {Access}  access
	 * @param   {Object}  data
	 * @returns {Promise}
	 */
	create: async (access, data) => {
		let thisData = data || {};
		const createCertificate = thisData.certificate_id === "new";

		if (createCertificate) {
			delete thisData.certificate_id;
		}

		await access.can("redirection_hosts:create", thisData);

		// Get a list of the domain names and check each of them against existing records

		const checkResults = await Promise.all(
			thisData.domain_names.map((domain_name) => internalHost.isHostnameTaken(domain_name)),
		);
		const taken = checkResults.find((result) => result.is_taken);
		if (taken) {
			throw new errs.ValidationError(`${taken.hostname} is already in use`);
		}
		// At this point the domains should have been checked
		thisData.owner_user_id = access.token.getUserId(1);
		thisData = internalHost.cleanSslHstsData(createCertificate, thisData);

		// Fix for db field not having a default value
		// for this optional field.
		if (typeof data.advanced_config === "undefined") {
			data.advanced_config = "";
		}

		const createdRow = utils.omitRow(omissions())(await redirectionHostModel.query().insertAndFetch(thisData));
		if (createCertificate) {
			const cert = await internalCertificate.createQuickCertificate(access, thisData);

			await internalRedirectionHost.update(access, {
				id: createdRow.id,
				certificate_id: cert.id,
			});
		}

		const row = await internalRedirectionHost.get(access, {
			id: createdRow.id,
			expand: ["certificate", "owner"],
		});

		await internalNginx.configure(redirectionHostModel, "redirection_host", row);
		thisData.meta = { ...thisData.meta, ...row.meta };

		await internalAuditLog.add(access, {
			action: "created",
			object_type: "redirection-host",
			object_id: row.id,
			meta: thisData,
		});

		return row;
	},

	/**
	 * @param  {Access}  access
	 * @param  {Object}  data
	 * @param  {Number}  data.id
	 * @return {Promise}
	 */
	update: async (access, data) => {
		let thisData = data || {};
		const createCertificate = thisData.certificate_id === "new";

		if (createCertificate) {
			delete thisData.certificate_id;
		}

		await access.can("redirection_hosts:update", thisData.id);

		// Get a list of the domain names and check each of them against existing records

		if (typeof thisData.domain_names !== "undefined") {
			const checkResults = await Promise.all(
				thisData.domain_names.map((domain_name) =>
					internalHost.isHostnameTaken(domain_name, "redirection", thisData.id),
				),
			);
			const taken = checkResults.find((result) => result.is_taken);
			if (taken) {
				throw new errs.ValidationError(`${taken.hostname} is already in use`);
			}
		}
		const existingRow = await internalRedirectionHost.get(access, { id: thisData.id });
		if (existingRow.id !== thisData.id) {
			// Sanity check that something crazy hasn't happened
			throw new errs.InternalValidationError(
				`Redirection Host could not be updated, IDs do not match: ${existingRow.id} !== ${thisData.id}`,
			);
		}

		if (createCertificate) {
			const cert = await internalCertificate.createQuickCertificate(access, {
				domain_names: thisData.domain_names || existingRow.domain_names,
				meta: { ...existingRow.meta, ...thisData.meta },
			});

			// update host with cert id
			thisData.certificate_id = cert.id;
		}
		// Add domain_names to the data in case it isn't there, so that the audit log renders correctly. The order is important here.
		thisData = { domain_names: existingRow.domain_names, ...thisData };

		thisData = internalHost.cleanSslHstsData(createCertificate, thisData, existingRow);

		await redirectionHostModel.query().where({ id: thisData.id }).patch(thisData);

		await internalAuditLog.add(access, {
			action: "updated",
			object_type: "redirection-host",
			object_id: existingRow.id,
			meta: thisData,
		});

		const row = await internalRedirectionHost.get(access, {
			id: thisData.id,
			expand: ["owner", "certificate"],
		});

		const new_meta = await internalNginx.configure(redirectionHostModel, "redirection_host", row);

		row.meta = new_meta;

		return _.omit(internalHost.cleanRowCertificateMeta(row), omissions());
	},

	/**
	 * @param  {Access}   access
	 * @param  {Object}   data
	 * @param  {Number}   data.id
	 * @param  {Array}    [data.expand]
	 * @param  {Array}    [data.omit]
	 * @return {Promise}
	 */
	get: async (access, data) => {
		const thisData = data || {};

		const access_data = await access.can("redirection_hosts:get", thisData.id);

		const query = redirectionHostModel
			.query()
			.where("is_deleted", 0)
			.andWhere("id", thisData.id)
			.allowGraph(redirectionHostModel.defaultAllowGraph)
			.first();

		if (access_data.permission_visibility !== "all") {
			query.andWhere("owner_user_id", access.token.getUserId(1));
		}

		if (typeof thisData.expand !== "undefined" && thisData.expand !== null) {
			query.withGraphFetched(`[${thisData.expand.join(", ")}]`);
		}

		const row = utils.omitRow(omissions())(await query);
		let thisRow = row;
		if (!thisRow?.id) {
			throw new errs.ItemNotFoundError(thisData.id);
		}
		thisRow = internalHost.cleanRowCertificateMeta(thisRow);
		// Custom omissions
		if (typeof thisData.omit !== "undefined" && thisData.omit !== null) {
			return _.omit(thisRow, thisData.omit);
		}
		return thisRow;
	},

	/**
	 * @param {Access}  access
	 * @param {Object}  data
	 * @param {Number}  data.id
	 * @param {String}  [data.reason]
	 * @returns {Promise}
	 */
	delete: async (access, data) => {
		await access.can("redirection_hosts:delete", data.id);

		const row = await internalRedirectionHost.get(access, { id: data.id });
		if (!row?.id) {
			throw new errs.ItemNotFoundError(data.id);
		}

		await redirectionHostModel.query().where("id", row.id).patch({
			is_deleted: 1,
		});

		await internalNginx.deleteConfig("redirection_host", row);
		await internalNginx.reload();

		await internalAuditLog.add(access, {
			action: "deleted",
			object_type: "redirection-host",
			object_id: row.id,
			meta: _.omit(row, omissions()),
		});

		return true;
	},

	/**
	 * @param {Access}  access
	 * @param {Object}  data
	 * @param {Number}  data.id
	 * @param {String}  [data.reason]
	 * @returns {Promise}
	 */
	enable: async (access, data) => {
		await access.can("redirection_hosts:update", data.id);

		const row = await internalRedirectionHost.get(access, {
			id: data.id,
			expand: ["certificate", "owner"],
		});

		if (!row?.id) {
			throw new errs.ItemNotFoundError(data.id);
		}
		if (row.enabled) {
			throw new errs.ValidationError("Host is already enabled");
		}

		const checkResults = await Promise.all(
			row.domain_names.map((domain_name) => internalHost.isHostnameTaken(domain_name)),
		);
		const taken = checkResults.find((result) => result.is_taken);
		if (taken) {
			throw new errs.ValidationError(`${taken.hostname} is already in use by an active host`);
		}
		row.enabled = 1;

		await redirectionHostModel.query().where("id", row.id).patch({
			enabled: 1,
		});

		await internalNginx.configure(redirectionHostModel, "redirection_host", row);

		await internalAuditLog.add(access, {
			action: "enabled",
			object_type: "redirection-host",
			object_id: row.id,
			meta: _.omit(row, omissions()),
		});

		return true;
	},

	/**
	 * @param {Access}  access
	 * @param {Object}  data
	 * @param {Number}  data.id
	 * @param {String}  [data.reason]
	 * @returns {Promise}
	 */
	disable: async (access, data) => {
		await access.can("redirection_hosts:update", data.id);

		const row = await internalRedirectionHost.get(access, { id: data.id });
		if (!row?.id) {
			throw new errs.ItemNotFoundError(data.id);
		}
		if (!row.enabled) {
			throw new errs.ValidationError("Host is already disabled");
		}

		row.enabled = 0;

		await redirectionHostModel.query().where("id", row.id).patch({
			enabled: 0,
		});

		await internalNginx.deleteConfig("redirection_host", row);
		await internalNginx.reload();

		await internalAuditLog.add(access, {
			action: "disabled",
			object_type: "redirection-host",
			object_id: row.id,
			meta: _.omit(row, omissions()),
		});

		return true;
	},

	/**
	 * All Hosts
	 *
	 * @param   {Access}  access
	 * @param   {Array}   [expand]
	 * @param   {String}  [search_query]
	 * @returns {Promise}
	 */
	getAll: async (access, expand, search_query) => {
		const access_data = await access.can("redirection_hosts:list");

		const query = redirectionHostModel
			.query()
			.where("is_deleted", 0)
			.groupBy("id")
			.allowGraph(redirectionHostModel.defaultAllowGraph)
			.orderBy(castJsonIfNeed("domain_names"), "ASC");

		if (access_data.permission_visibility !== "all") {
			query.andWhere("owner_user_id", access.token.getUserId(1));
		}

		// Query is used for searching
		if (typeof search_query === "string" && search_query.length > 0) {
			query.where(function () {
				this.where(castJsonIfNeed("domain_names"), "like", `%${search_query}%`);
			});
		}

		if (typeof expand !== "undefined" && expand !== null) {
			query.withGraphFetched(`[${expand.join(", ")}]`);
		}

		const rows = utils.omitRows(omissions())(await query);
		if (typeof expand !== "undefined" && expand !== null && expand.indexOf("certificate") !== -1) {
			return internalHost.cleanAllRowsCertificateMeta(rows);
		}

		return rows;
	},

	/**
	 * Report use
	 *
	 * @param   {Number}  user_id
	 * @param   {String}  visibility
	 * @returns {Promise}
	 */
	getCount: async (user_id, visibility) => {
		const query = redirectionHostModel.query().count("id as count").where("is_deleted", 0);

		if (visibility !== "all") {
			query.andWhere("owner_user_id", user_id);
		}

		const row = await query.first();

		return Number.parseInt(row.count, 10);
	},
};

export default internalRedirectionHost;
