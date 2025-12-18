import gravatar from "gravatar";
import _ from "lodash";
import errs from "../lib/error.js";
import utils from "../lib/utils.js";
import authModel from "../models/auth.js";
import userModel from "../models/user.js";
import userPermissionModel from "../models/user_permission.js";
import internalAuditLog from "./audit-log.js";
import internalToken from "./token.js";

const omissions = () => {
	return ["is_deleted", "permissions.id", "permissions.user_id", "permissions.created_on", "permissions.modified_on"];
};

const DEFAULT_AVATAR = gravatar.url("admin@example.com", { default: "mm" });

const internalUser = {
	/**
	 * Create a user can happen unauthenticated only once and only when no active users exist.
	 * Otherwise, a valid auth method is required.
	 *
	 * @param   {Access}  access
	 * @param   {Object}  data
	 * @returns {Promise}
	 */
	create: async (access, data) => {
		const auth = data.auth || null;
		delete data.auth;

		data.avatar = data.avatar || "";
		data.roles = data.roles || [];

		data.email = data.email.toLowerCase().trim();
		const available = await internalUser.isEmailAvailable(data.email);
		if (!available) {
			throw new errs.ValidationError(`Email address already in use - ${data.email}`);
		}

		if (typeof data.is_disabled !== "undefined") {
			data.is_disabled = data.is_disabled ? 1 : 0;
		}

		await access.can("users:create", data);
		data.avatar = gravatar.url(data.email, { default: "mm" });

		let user = await userModel.query().insertAndFetch(data);
		user = _.omit(user, omissions());

		if (auth) {
			await authModel.query().insert({
				user_id: user.id,
				type: auth.type,
				secret: auth.secret,
				meta: {},
			});
		}

		// Create permissions row as well
		const isAdmin = data.roles.indexOf("admin") !== -1;

		await userPermissionModel.query().insert({
			user_id: user.id,
			visibility: isAdmin ? "all" : "user",
			proxy_hosts: "manage",
			redirection_hosts: "manage",
			dead_hosts: "manage",
			streams: "manage",
			access_lists: "manage",
			certificates: "manage",
		});

		user = await internalUser.get(access, { id: user.id, expand: ["permissions"] });

		await internalAuditLog.add(access, {
			action: "created",
			object_type: "user",
			object_id: user.id,
			meta: user,
		});

		return user;
	},

	/**
	 * @param  {Access}  access
	 * @param  {Object}  data
	 * @param  {Integer} data.id
	 * @param  {String}  [data.email]
	 * @param  {String}  [data.name]
	 * @return {Promise}
	 */
	update: async (access, data) => {
		if (typeof data.is_disabled !== "undefined") {
			data.is_disabled = data.is_disabled ? 1 : 0;
		}

		await access.can("users:update", data.id);

		// Make sure that the user being updated doesn't change their email to another user that is already using it
		// 1. get user we want to update
		let user = await internalUser.get(access, { id: data.id });

		// 2. if email is to be changed, find other users with that email
		if (typeof data.email !== "undefined") {
			data.email = data.email.toLowerCase().trim();

			if (user.email !== data.email) {
				const available = await internalUser.isEmailAvailable(data.email, data.id);
				if (!available) {
					throw new errs.ValidationError(`Email address already in use - ${data.email}`);
				}
			}
		}

		if (user.id !== data.id) {
			// Sanity check that something crazy hasn't happened
			throw new errs.InternalValidationError(
				`User could not be updated, IDs do not match: ${user.id} !== ${data.id}`,
			);
		}

		data.avatar = gravatar.url(data.email || user.email, { default: "mm" });

		await userModel.query().patchAndFetchById(user.id, data);
		user = await internalUser.get(access, { id: data.id });

		// Add to audit log
		await internalAuditLog.add(access, {
			action: "updated",
			object_type: "user",
			object_id: user.id,
			meta: { ...data, id: user.id, name: user.name },
		});

		return user;
	},

	/**
	 * @param  {Access}   access
	 * @param  {Object}   [data]
	 * @param  {Integer}  [data.id]          Defaults to the token user
	 * @param  {Array}    [data.expand]
	 * @param  {Array}    [data.omit]
	 * @return {Promise}
	 */
	get: async (access, data) => {
		const thisData = data || {};

		if (typeof thisData.id === "undefined" || !thisData.id) {
			thisData.id = access.token.getUserId(0);
		}

		await access.can("users:get", thisData.id);

		const query = userModel
			.query()
			.where("is_deleted", 0)
			.andWhere("id", thisData.id)
			.allowGraph("[permissions]")
			.first();

		if (typeof thisData.expand !== "undefined" && thisData.expand !== null) {
			query.withGraphFetched(`[${thisData.expand.join(", ")}]`);
		}

		let row = await query;
		row = _.omit(row, omissions());

		if (!row || !row.id) {
			throw new errs.ItemNotFoundError(thisData.id);
		}
		// Custom omissions
		if (typeof thisData.omit !== "undefined" && thisData.omit !== null) {
			return _.omit(row, thisData.omit);
		}

		if (row.avatar === "") {
			row.avatar = DEFAULT_AVATAR;
		}

		return row;
	},

	/**
	 * Checks if an email address is available, but if a user_id is supplied, it will ignore checking
	 * against that user.
	 *
	 * @param email
	 * @param user_id
	 */
	isEmailAvailable: async (email, user_id) => {
		const query = userModel.query().where("email", "=", email.toLowerCase().trim()).where("is_deleted", 0).first();

		if (typeof user_id !== "undefined") {
			query.where("id", "!=", user_id);
		}

		const user = await query;
		return !user;
	},

	/**
	 * @param {Access}  access
	 * @param {Object}  data
	 * @param {Integer} data.id
	 * @param {String}  [data.reason]
	 * @returns {Promise}
	 */
	delete: async (access, data) => {
		await access.can("users:delete", data.id);
		const user = await internalUser.get(access, { id: data.id });

		if (!user) {
			throw new errs.ItemNotFoundError(data.id);
		}

		// Make sure user can't delete themselves
		if (user.id === access.token.getUserId(0)) {
			throw new errs.PermissionError("You cannot delete yourself.");
		}

		await userModel.query().where("id", user.id).patch({
			is_deleted: 1,
		});

		// Add to audit log
		await internalAuditLog.add(access, {
			action: "deleted",
			object_type: "user",
			object_id: user.id,
			meta: _.omit(user, omissions()),
		});

		return true;
	},

	deleteAll: async () => {
		await userModel.query().patch({
			is_deleted: 1,
		});
	},

	/**
	 * This will only count the users
	 *
	 * @param   {Access}  access
	 * @param   {String}  [search_query]
	 * @returns {*}
	 */
	getCount: async (access, search_query) => {
		await access.can("users:list");
		const query = userModel.query().count("id as count").where("is_deleted", 0).first();

		// Query is used for searching
		if (typeof search_query === "string") {
			query.where(function () {
				this.where("user.name", "like", `%${search_query}%`).orWhere("user.email", "like", `%${search_query}%`);
			});
		}

		const row = await query;
		return Number.parseInt(row.count, 10);
	},

	/**
	 * All users
	 *
	 * @param   {Access}  access
	 * @param   {Array}   [expand]
	 * @param   {String}  [search_query]
	 * @returns {Promise}
	 */
	getAll: async (access, expand, search_query) => {
		await access.can("users:list");
		const query = userModel
			.query()
			.where("is_deleted", 0)
			.groupBy("id")
			.allowGraph("[permissions]")
			.orderBy("name", "ASC");

		// Query is used for searching
		if (typeof search_query === "string") {
			query.where(function () {
				this.where("name", "like", `%${search_query}%`).orWhere("email", "like", `%${search_query}%`);
			});
		}

		if (typeof expand !== "undefined" && expand !== null) {
			query.withGraphFetched(`[${expand.join(", ")}]`);
		}

		const res = await query;
		return utils.omitRows(omissions())(res);
	},

	/**
	 * @param   {Access} access
	 * @param   {Integer} [id_requested]
	 * @returns {[String]}
	 */
	getUserOmisionsByAccess: (access, idRequested) => {
		let response = []; // Admin response

		if (!access.token.hasScope("admin") && access.token.getUserId(0) !== idRequested) {
			response = ["is_deleted"]; // Restricted response
		}

		return response;
	},

	/**
	 * @param  {Access}  access
	 * @param  {Object}  data
	 * @param  {Integer} data.id
	 * @param  {String}  data.type
	 * @param  {String}  data.secret
	 * @return {Promise}
	 */
	setPassword: async (access, data) => {
		await access.can("users:password", data.id);
		const user = await internalUser.get(access, { id: data.id });

		if (user.id !== data.id) {
			// Sanity check that something crazy hasn't happened
			throw new errs.InternalValidationError(
				`User could not be updated, IDs do not match: ${user.id} !== ${data.id}`,
			);
		}

		if (user.id === access.token.getUserId(0)) {
			// they're setting their own password. Make sure their current password is correct
			if (typeof data.current === "undefined" || !data.current) {
				throw new errs.ValidationError("Current password was not supplied");
			}

			await internalToken.getTokenFromEmail({
				identity: user.email,
				secret: data.current,
			});
		}

		// Get auth, patch if it exists
		const existing_auth = await authModel.query().where("user_id", user.id).andWhere("type", data.type).first();

		if (existing_auth) {
			// patch
			await authModel.query().where("user_id", user.id).andWhere("type", data.type).patch({
				type: data.type, // This is required for the model to encrypt on save
				secret: data.secret,
			});
		} else {
			// insert
			await authModel.query().insert({
				user_id: user.id,
				type: data.type,
				secret: data.secret,
				meta: {},
			});
		}

		// Add to Audit Log
		await internalAuditLog.add(access, {
			action: "updated",
			object_type: "user",
			object_id: user.id,
			meta: {
				name: user.name,
				password_changed: true,
				auth_type: data.type,
			},
		});

		return true;
	},

	/**
	 * @param  {Access}  access
	 * @param  {Object}  data
	 * @return {Promise}
	 */
	setPermissions: async (access, data) => {
		await access.can("users:permissions", data.id);
		const user = await internalUser.get(access, { id: data.id });

		if (user.id !== data.id) {
			// Sanity check that something crazy hasn't happened
			throw new errs.InternalValidationError(
				`User could not be updated, IDs do not match: ${user.id} !== ${data.id}`,
			);
		}

		// Get perms row, patch if it exists
		const existing_auth = await userPermissionModel.query().where("user_id", user.id).first();

		let permissions;
		if (existing_auth) {
			// patch
			permissions = await userPermissionModel
				.query()
				.where("user_id", user.id)
				.patchAndFetchById(existing_auth.id, _.assign({ user_id: user.id }, data));
		} else {
			// insert
			permissions = await userPermissionModel.query().insertAndFetch(_.assign({ user_id: user.id }, data));
		}

		// Add to Audit Log
		await internalAuditLog.add(access, {
			action: "updated",
			object_type: "user",
			object_id: user.id,
			meta: {
				name: user.name,
				permissions: permissions,
			},
		});

		return true;
	},

	/**
	 * @param {Access}   access
	 * @param {Object}   data
	 * @param {Integer}  data.id
	 */
	loginAs: async (access, data) => {
		await access.can("users:loginas", data.id);
		const user = await internalUser.get(access, data);
		return internalToken.getTokenFromUser(user);
	},
};

export default internalUser;
