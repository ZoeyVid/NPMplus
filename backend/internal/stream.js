import _ from "lodash";
import errs from "../lib/error.js";
import { castJsonIfNeed } from "../lib/helpers.js";
import utils from "../lib/utils.js";
import streamModel from "../models/stream.js";
import internalAuditLog from "./audit-log.js";
import internalCertificate from "./certificate.js";
import internalHost from "./host.js";
import internalNginx from "./nginx.js";

const omissions = () => {
	return ["is_deleted", "owner.is_deleted", "certificate.is_deleted"];
};

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

		// Check for port collision
		const collision = await streamModel
			.query()
			.where("is_deleted", 0)
			.andWhere("incoming_port", data.incoming_port)
			.andWhere(function () {
				this.where(function () {
					if (data.tcp_forwarding) {
						this.where("tcp_forwarding", 1);
					} else {
						this.where("tcp_forwarding", 2); // Impossible condition to skip
					}
				}).orWhere(function () {
					if (data.udp_forwarding) {
						this.where("udp_forwarding", 1);
					} else {
						this.where("udp_forwarding", 2); // Impossible condition to skip
					}
				});
			})
			.first();

		if (collision) {
			throw new errs.ValidationError(`Incoming port ${data.incoming_port} is already in use by another stream.`);
		}

		data.owner_user_id = access.token.getUserId(1);

		if (typeof data.meta === "undefined") {
			data.meta = {};
		}

		// streams aren't routed by domain name so don't store domain names in the DB
		const data_no_domains = structuredClone(data);
		delete data_no_domains.domain_names;

		let row = await streamModel.query().insertAndFetch(data_no_domains);
		row = utils.omitRow(omissions())(row);

		if (create_certificate) {
			const cert = await internalCertificate.createQuickCertificate(access, data);
			// update host with cert id
			await internalStream.update(access, {
				id: row.id,
				certificate_id: cert.id,
			});
		}

		// re-fetch with cert
		row = await internalStream.get(access, {
			id: row.id,
			expand: ["certificate", "owner"],
		});

		// Configure nginx
		await internalNginx.configure(streamModel, "stream", row);

		// Add to audit log
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

		// Check for port collision (excluding self)
		const collision = await streamModel
			.query()
			.where("is_deleted", 0)
			.andWhere("incoming_port", thisData.incoming_port)
			.andWhere(function () {
				this.where(function () {
					if (thisData.tcp_forwarding) {
						this.where("tcp_forwarding", 1);
					} else {
						this.where("tcp_forwarding", 2); // Impossible condition to skip
					}
				}).orWhere(function () {
					if (thisData.udp_forwarding) {
						this.where("udp_forwarding", 1);
					} else {
						this.where("udp_forwarding", 2); // Impossible condition to skip
					}
				});
			})
			.andWhereNot("id", thisData.id)
			.first();

		if (collision) {
			throw new errs.ValidationError(
				`Incoming port ${thisData.incoming_port} is already in use by another stream.`,
			);
		}

		let row = await internalStream.get(access, { id: thisData.id });

		if (row.id !== thisData.id) {
			// Sanity check that something crazy hasn't happened
			throw new errs.InternalValidationError(
				`Stream could not be updated, IDs do not match: ${row.id} !== ${thisData.id}`,
			);
		}

		if (create_certificate) {
			const cert = await internalCertificate.createQuickCertificate(access, {
				domain_names: thisData.domain_names || row.domain_names,
				meta: _.assign({}, row.meta, thisData.meta),
			});
			// update host with cert id
			thisData.certificate_id = cert.id;
		}

		// Add domain_names to the data in case it isn't there, so that the audit log renders correctly. The order is important here.
		thisData = _.assign(
			{},
			{
				domain_names: row.domain_names,
			},
			data,
		);

		let saved_row = await streamModel.query().patchAndFetchById(row.id, thisData);

		saved_row = utils.omitRow(omissions())(saved_row);

		// Add to audit log
		await internalAuditLog.add(access, {
			action: "updated",
			object_type: "stream",
			object_id: row.id,
			meta: thisData,
		});

		row = await internalStream.get(access, { id: thisData.id, expand: ["owner", "certificate"] });

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
			.allowGraph("[owner,certificate]")
			.first();

		if (access_data.permission_visibility !== "all") {
			query.andWhere("owner_user_id", access.token.getUserId(1));
		}

		if (typeof thisData.expand !== "undefined" && thisData.expand !== null) {
			query.withGraphFetched(`[${thisData.expand.join(", ")}]`);
		}

		let row = await query;
		row = utils.omitRow(omissions())(row);

		if (!row || !row.id) {
			throw new errs.ItemNotFoundError(thisData.id);
		}
		row = internalHost.cleanRowCertificateMeta(row);
		// Custom omissions
		if (typeof thisData.omit !== "undefined" && thisData.omit !== null) {
			return _.omit(row, thisData.omit);
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
		await access.can("streams:delete", data.id);
		const row = await internalStream.get(access, { id: data.id });

		if (!row || !row.id) {
			throw new errs.ItemNotFoundError(data.id);
		}

		await streamModel.query().where("id", row.id).patch({
			is_deleted: 1,
		});

		// Delete Nginx Config
		await internalNginx.deleteConfig("stream", row);
		await internalNginx.reload();

		// Add to audit log
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

		if (!row || !row.id) {
			throw new errs.ItemNotFoundError(data.id);
		}
		if (row.enabled) {
			throw new errs.ValidationError("Stream is already enabled");
		}

		row.enabled = 1;

		await streamModel.query().where("id", row.id).patch({
			enabled: 1,
		});

		// Configure nginx
		await internalNginx.configure(streamModel, "stream", row);

		// Add to audit log
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

		if (!row || !row.id) {
			throw new errs.ItemNotFoundError(data.id);
		}
		if (!row.enabled) {
			throw new errs.ValidationError("Stream is already disabled");
		}

		row.enabled = 0;

		await streamModel.query().where("id", row.id).patch({
			enabled: 0,
		});

		// Delete Nginx Config
		await internalNginx.deleteConfig("stream", row);
		await internalNginx.reload();

		// Add to audit log
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
			.allowGraph("[owner,certificate]")
			.orderBy("incoming_port", "ASC");

		if (access_data.permission_visibility !== "all") {
			query.andWhere("owner_user_id", access.token.getUserId(1));
		}

		// Query is used for searching
		if (typeof search_query === "string" && search_query.length > 0) {
			query.where(function () {
				this.where(castJsonIfNeed("incoming_port"), "like", `%${search_query}%`);
			});
		}

		if (typeof expand !== "undefined" && expand !== null) {
			query.withGraphFetched(`[${expand.join(", ")}]`);
		}

		let rows = await query;
		rows = utils.omitRows(omissions())(rows);

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
