import _ from "lodash";
import errs from "../lib/error.js";
import { castJsonIfNeed } from "../lib/helpers.js";
import utils from "../lib/utils.js";
import streamModel from "../models/stream.js";
import internalAuditLog from "./audit-log.js";
import internalCertificate from "./certificate.js";
import internalHost from "./host.js";
import internalNginx from "./nginx.js";

const omissions = () => ["is_deleted", "owner.is_deleted", "certificate.is_deleted"];

const internalStream = {
	/**
	 * @param   {Access}  access
	 * @param   {Object}  data
	 * @returns {Promise}
	 */
	create: async (access, data) => {
		const create_certificate = data.certificate_id === "new";

		if (create_certificate) {
			delete data.certificate_id;
		}

		await access.can("streams:create", data);

		// TODO: At this point the existing ports should have been checked
		data.owner_user_id = access.token.getUserId(1);

		if (typeof data.meta === "undefined") {
			data.meta = {};
		}
		if (typeof data.npmplus_advanced_config === "undefined") {
			data.npmplus_advanced_config = "";
		}

		// streams aren't routed by domain name so don't store domain names in the DB
		const data_no_domains = structuredClone(data);
		delete data_no_domains.domain_names;

		const createdRow = utils.omitRow(omissions())(await streamModel.query().insertAndFetch(data_no_domains));
		if (create_certificate) {
			const cert = await internalCertificate.createQuickCertificate(access, data);

			await internalStream.update(access, {
				id: createdRow.id,
				certificate_id: cert.id,
			});
		}

		const row = await internalStream.get(access, {
			id: createdRow.id,
			expand: ["certificate", "owner"],
		});

		await internalNginx.configure(streamModel, "stream", row);

		await internalAuditLog.add(access, {
			action: "created",
			object_type: "stream",
			object_id: row.id,
			meta: data,
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
		let thisData = data;
		const create_certificate = thisData.certificate_id === "new";

		if (create_certificate) {
			delete thisData.certificate_id;
		}

		await access.can("streams:update", thisData.id);

		const existingRow = await internalStream.get(access, { id: thisData.id });
		if (existingRow.id !== thisData.id) {
			// Sanity check that something crazy hasn't happened
			throw new errs.InternalValidationError(
				`Stream could not be updated, IDs do not match: ${existingRow.id} !== ${thisData.id}`,
			);
		}

		if (create_certificate) {
			const cert = await internalCertificate.createQuickCertificate(access, {
				domain_names: thisData.domain_names || existingRow.domain_names,
				meta: { ...existingRow.meta, ...thisData.meta },
			});

			// update host with cert id
			thisData.certificate_id = cert.id;
		}
		// Add domain_names to the data in case it isn't there, so that the audit log renders correctly. The order is important here.
		thisData = { domain_names: existingRow.domain_names, ...thisData };

		await streamModel.query().patchAndFetchById(existingRow.id, thisData);

		await internalAuditLog.add(access, {
			action: "updated",
			object_type: "stream",
			object_id: existingRow.id,
			meta: thisData,
		});

		const row = await internalStream.get(access, { id: thisData.id, expand: ["owner", "certificate"] });
		const new_meta = await internalNginx.configure(streamModel, "stream", row);
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

		const access_data = await access.can("streams:get", thisData.id);

		const query = streamModel
			.query()
			.where("is_deleted", 0)
			.andWhere("id", thisData.id)
			.allowGraph(streamModel.defaultAllowGraph)
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
		await access.can("streams:delete", data.id);

		const row = await internalStream.get(access, { id: data.id });
		if (!row?.id) {
			throw new errs.ItemNotFoundError(data.id);
		}

		await streamModel.query().where("id", row.id).patch({
			is_deleted: 1,
		});

		await internalNginx.deleteConfig("stream", row);
		await internalNginx.reload();

		await internalAuditLog.add(access, {
			action: "deleted",
			object_type: "stream",
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
		await access.can("streams:update", data.id);

		const row = await internalStream.get(access, {
			id: data.id,
			expand: ["certificate", "owner"],
		});

		if (!row?.id) {
			throw new errs.ItemNotFoundError(data.id);
		}
		if (row.enabled) {
			throw new errs.ValidationError("Stream is already enabled");
		}

		row.enabled = 1;

		await streamModel.query().where("id", row.id).patch({
			enabled: 1,
		});

		await internalNginx.configure(streamModel, "stream", row);

		await internalAuditLog.add(access, {
			action: "enabled",
			object_type: "stream",
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
		await access.can("streams:update", data.id);

		const row = await internalStream.get(access, { id: data.id });
		if (!row?.id) {
			throw new errs.ItemNotFoundError(data.id);
		}
		if (!row.enabled) {
			throw new errs.ValidationError("Stream is already disabled");
		}

		row.enabled = 0;

		await streamModel.query().where("id", row.id).patch({
			enabled: 0,
		});

		await internalNginx.deleteConfig("stream", row);
		await internalNginx.reload();

		await internalAuditLog.add(access, {
			action: "disabled",
			object_type: "stream",
			object_id: row.id,
			meta: _.omit(row, omissions()),
		});

		return true;
	},

	/**
	 * All Streams
	 *
	 * @param   {Access}  access
	 * @param   {Array}   [expand]
	 * @param   {String}  [search_query]
	 * @returns {Promise}
	 */
	getAll: async (access, expand, search_query) => {
		const access_data = await access.can("streams:list");

		const query = streamModel
			.query()
			.where("is_deleted", 0)
			.groupBy("id")
			.allowGraph(streamModel.defaultAllowGraph)
			.orderBy("incoming_port", "ASC");

		if (access_data.permission_visibility !== "all") {
			query.andWhere("owner_user_id", access.token.getUserId(1));
		}

		// Query is used for searching
		if (typeof search_query === "string" && search_query.length > 0) {
			query.where(function () {
				this.where(castJsonIfNeed("incoming_port"), "like", `%${search_query}%`)
					.orWhere(castJsonIfNeed("forwarding_port"), "like", `%${search_query}%`)
					.orWhere("forwarding_host", "like", `%${search_query}%`)
					.orWhere("npmplus_description", "like", `%${search_query}%`);
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
		const query = streamModel.query().count("id AS count").where("is_deleted", 0);

		if (visibility !== "all") {
			query.andWhere("owner_user_id", user_id);
		}

		const row = await query.first();

		return Number.parseInt(row.count, 10);
	},
};

export default internalStream;
