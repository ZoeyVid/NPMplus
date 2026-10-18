import errs from "../lib/error.js";
import { castJsonIfNeed } from "../lib/helpers.js";
import streamModel from "../models/stream.js";
import internalAuditLog from "./audit-log.js";
import internalCertificate from "./certificate.js";
import internalNginx from "./nginx.js";

const cleanStreamData = (data, existingData) => {
	const combinedData = { ...existingData, ...data };

	if (!combinedData.tcp_forwarding && !combinedData.udp_forwarding) {
		throw new errs.ValidationError("TCP or UDP forwarding needs to be enabled");
	}

	if (combinedData.udp_forwarding) {
		combinedData.npmplus_proxy_tls = false;
		if (combinedData.npmplus_proxy_protocol_forwarding === 1) combinedData.npmplus_proxy_protocol_forwarding = 0;
		combinedData.certificate_id = 0;
	}

	if (combinedData.certificate_id !== "new" && !(combinedData.certificate_id > 0)) {
		combinedData.npmplus_mtls_certificate_id = 0;
	}

	if (!(combinedData.npmplus_mtls_certificate_id > 0)) {
		combinedData.npmplus_mtls_verify_client_optional = false;
	}

	return combinedData;
};

const internalStream = {
	/**
	 * @param   {Access}  access
	 * @param   {Object}  data
	 * @returns {Promise}
	 */
	create: async (access, data) => {
		const thisData = cleanStreamData(data);
		const createCertificate = thisData.certificate_id === "new";

		if (createCertificate) {
			delete thisData.certificate_id;
		} else if (thisData.certificate_id > 0) {
			await internalCertificate.get(access, { id: thisData.certificate_id });
		}
		if (thisData.npmplus_mtls_certificate_id > 0) {
			await internalCertificate.get(access, { id: thisData.npmplus_mtls_certificate_id });
		}

		access.can("streams:manage");

		thisData.owner_user_id = access.token.getUserId(1);

		if (createCertificate) {
			thisData.certificate_id = (await internalCertificate.createQuickCertificate(access, thisData)).id;
		}

		const createdRow = await streamModel.query().insertAndFetch(thisData);

		let savedRow;
		try {
			const row = await internalStream.get(access, {
				id: createdRow.id,
				expand: ["certificate"],
			});

			// Configure nginx
			await internalNginx.configure(streamModel, "stream", row);
		} finally {
			savedRow = await internalStream.get(access, { id: createdRow.id });

			// Add to audit log
			await internalAuditLog.add(access, {
				action: "created",
				object_type: "stream",
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
		const existingRow = await internalStream.get(access, { id: data.id });

		const thisData = cleanStreamData(data, existingRow);
		const createCertificate = thisData.certificate_id === "new";

		if (createCertificate) {
			delete thisData.certificate_id;
		} else if (thisData.certificate_id > 0) {
			await internalCertificate.get(access, { id: thisData.certificate_id });
		}
		if (thisData.npmplus_mtls_certificate_id > 0) {
			await internalCertificate.get(access, { id: thisData.npmplus_mtls_certificate_id });
		}

		access.can("streams:manage");

		if (createCertificate) {
			const cert = await internalCertificate.createQuickCertificate(access, thisData);

			// update host with cert id
			thisData.certificate_id = cert.id;
		}

		await streamModel.query().where({ id: thisData.id }).patch(thisData);

		let savedRow;
		try {
			const row = await internalStream.get(access, {
				id: thisData.id,
				expand: ["certificate"],
			});

			// Configure nginx
			await internalNginx.configure(streamModel, "stream", row);
		} finally {
			savedRow = await internalStream.get(access, { id: thisData.id });

			// Add to audit log
			await internalAuditLog.add(access, {
				action: "updated",
				object_type: "stream",
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
		access.can("streams:view");

		const query = streamModel.query().where("id", data.id).allowGraph("[certificate]").first();

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
		access.can("streams:manage");

		const row = await internalStream.get(access, { id: data.id });

		await streamModel.query().deleteById(row.id);

		try {
			// Delete Nginx Config
			await internalNginx.deleteConfig("stream", row);
			await internalNginx.reload();
		} finally {
			// Add to audit log
			await internalAuditLog.add(access, {
				action: "deleted",
				object_type: "stream",
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
		access.can("streams:manage");

		const row = await internalStream.get(access, {
			id: data.id,
			expand: ["certificate"],
		});
		if (row.enabled) {
			throw new errs.ValidationError("Stream is already enabled");
		}

		row.enabled = 1;

		await streamModel.query().where("id", row.id).patch({
			enabled: 1,
		});

		let savedRow;
		try {
			// Configure nginx
			await internalNginx.configure(streamModel, "stream", row);
		} finally {
			savedRow = await internalStream.get(access, { id: row.id });

			// Add to audit log
			await internalAuditLog.add(access, {
				action: "enabled",
				object_type: "stream",
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
		access.can("streams:manage");

		const row = await internalStream.get(access, { id: data.id });
		if (!row.enabled) {
			throw new errs.ValidationError("Stream is already disabled");
		}

		await streamModel.query().where("id", row.id).patch({
			enabled: 0,
		});

		let savedRow;
		try {
			// Delete Nginx Config
			await internalNginx.deleteConfig("stream", row);
			await internalNginx.reload();
		} finally {
			savedRow = await internalStream.get(access, { id: row.id });

			// Add to audit log
			await internalAuditLog.add(access, {
				action: "disabled",
				object_type: "stream",
				object_id: row.id,
				meta: savedRow,
			});
		}

		return savedRow;
	},

	/**
	 * All Streams
	 *
	 * @param   {Access}  access
	 * @param   {Array}   [expand]
	 * @param   {String}  [searchQuery]
	 * @returns {Promise}
	 */
	getAll: (access, expand, searchQuery) => {
		access.can("streams:view");

		const query = streamModel
			.query()
			.groupBy("id")
			.allowGraph("[owner,certificate]")
			.orderBy("incoming_port", "ASC");

		if (access.visibility !== "all") {
			query.andWhere("owner_user_id", access.token.getUserId(1));
		}

		// Query is used for searching
		if (typeof searchQuery === "string" && searchQuery.length > 0) {
			query.where(function () {
				this.where(castJsonIfNeed("incoming_port"), "like", `%${searchQuery}%`)
					.orWhere(castJsonIfNeed("forwarding_port"), "like", `%${searchQuery}%`)
					.orWhere("forwarding_host", "like", `%${searchQuery}%`)
					.orWhere("npmplus_description", "like", `%${searchQuery}%`);
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
		const query = streamModel.query();

		if (visibility !== "all") {
			query.andWhere("owner_user_id", user_id);
		}

		return query.resultSize();
	},
};

export default internalStream;
