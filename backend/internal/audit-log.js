import { raw } from "objection";
import errs from "../lib/error.js";
import { castJsonIfNeed } from "../lib/helpers.js";
import auditLogModel from "../models/audit-log.js";

const internalAuditLog = {
	/**
	 * All logs
	 *
	 * @param   {Access}  access
	 * @param   {Object}  data
	 * @param   {Array}   [data.expand]
	 * @param   {String}  [data.query]
	 * @param   {Number}  data.page
	 * @param   {Number}  data.page_size
	 * @returns {Promise}
	 */
	getAll: (access, data) => {
		access.canAdmin();

		const query = auditLogModel
			.query()
			.orderBy("created_on", "DESC")
			.orderBy("id", "DESC")
			.page(data.page, data.page_size)
			.allowGraph("[user]");

		if (data.query) {
			const like = `%${data.query.toLowerCase()}%`;
			query.where((builder) =>
				builder
					.whereILike("object_type", like)
					.orWhereILike("action", like)
					.orWhereILike(raw("lower(??)", castJsonIfNeed("meta")), like),
			);
		}

		if (data.expand) query.withGraphFetched(`[${data.expand.join(", ")}]`);

		return query;
	},

	/**
	 * @param  {Access}   access
	 * @param  {Object}   [data]
	 * @param  {Integer}  [data.id]          Defaults to the token user
	 * @param  {Array}    [data.expand]
	 * @return {Promise}
	 */
	get: async (access, data) => {
		access.canAdmin();

		const query = auditLogModel.query().andWhere("id", data.id).allowGraph("[user]").first();

		if (data.expand) query.withGraphFetched(`[${data.expand.join(", ")}]`);

		const row = await query;
		if (!row?.id) {
			throw new errs.ItemNotFoundError(data.id);
		}

		return row;
	},

	/**
	 * This method should not be publicly used, it doesn't check certain things. It will be assumed
	 * that permission to add to audit log is already considered, however the access token is used for
	 * default user id determination.
	 *
	 * @param   {Access}   access
	 * @param   {Object}   data
	 * @param   {String}   data.action
	 * @param   {Number}   [data.user_id]
	 * @param   {Number}   [data.object_id]
	 * @param   {Number}   [data.object_type]
	 * @param   {Object}   [data.meta]
	 * @returns {Promise}
	 */
	add: (access, data) => {
		data.user_id ||= access.token.getUserId(1);

		if (!data.action) throw new errs.InternalValidationError("Audit log entry must contain an Action");

		// Make sure at least 1 of the IDs are set and action
		return auditLogModel.query().insert({
			user_id: data.user_id,
			action: data.action,
			object_type: data.object_type || "",
			object_id: data.object_id || 0,
			meta: data.meta || {},
		});
	},
};

export default internalAuditLog;
