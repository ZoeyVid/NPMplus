import crypto from "node:crypto";
import { rm, writeFile } from "node:fs/promises";
import _ from "lodash";
import errs from "../lib/error.js";
import utils from "../lib/utils.js";
import { gravatar as logger } from "../logger.js";
import authModel from "../models/auth.js";
import userModel from "../models/user.js";
import userPermissionModel from "../models/user_permission.js";
import pjson from "../package.json" with { type: "json" };
import internalAuditLog from "./audit-log.js";
import internalToken from "./token.js";

const omissions = () => [
	"is_deleted",
	"permissions.id",
	"permissions.user_id",
	"permissions.created_on",
	"permissions.modified_on",
];

const avatarExts = ["png", "jpg", "gif", "webp"];

const avatarExt = (b) => {
	if (!b || b.length < 12) return null;
	if (b.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) return "png";
	if (b.subarray(0, 3).equals(Buffer.from("ffd8ff", "hex"))) return "jpg";
	if (b.subarray(0, 4).toString("latin1") === "GIF8") return "gif";
	if (b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP")
		return "webp";
	return null;
};

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

		if (typeof data.is_disabled !== "undefined") {
			data.is_disabled = data.is_disabled ? 1 : 0;
		}

		await access.can("users:create", data);

		if (!(await internalUser.isEmailAvailable(data.email))) {
			throw new errs.ValidationError(`Email address already in use - ${data.email}`);
		}

		if (process.env.DISABLE_GRAVATAR === "true") {
			data.avatar = "/images/default-avatar.jpg";
		} else {
			try {
				const hash = crypto.createHash("sha256").update(data.email.trim().toLowerCase()).digest("hex");
				const response = await fetch(
					`https://www.gravatar.com/avatar/${hash}?s=64&default=initials&name=${encodeURIComponent(
						data.name
							.split(" ")
							.map((n) => n[0])
							.join(""),
					)}`,
					{
						headers: {
							"User-Agent": `NPMplus/${pjson.version}`,
						},
					},
				);

				if (!response.ok) throw new Error(`Status code: ${response.status}`);

				let ext;
				switch (response.headers.get("content-type")) {
					case "image/png":
						ext = "png";
						break;
					case "image/jpeg":
						ext = "jpg";
						break;
					case "image/gif":
						ext = "gif";
						break;
					default:
						throw new Error(`Unsupported content-type: ${response.headers.get("content-type")}`);
				}

				const buffer = await response.arrayBuffer();
				await writeFile(`/data/npmplus/gravatar/${hash}.${ext}`, Buffer.from(buffer));

				data.avatar = `/images/gravatar/${hash}.${ext}`;
			} catch (err) {
				logger.error(`Error downloading gravatar: ${err.message}`);
				data.avatar = "/images/default-avatar.jpg";
			}
		}

		let user = utils.omitRow(omissions())(await userModel.query().insertAndFetch(data));
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

	setAvatar: async (access, id, file) => {
		await access.can("users:update", id);
		const ext = avatarExt(file?.buffer);
		if (!ext) throw new errs.ValidationError("Invalid avatar file type");
		const user = await internalUser.get(access, { id });
		await Promise.all(avatarExts.map((e) => rm(`/data/npmplus/avatar/${user.id}.${e}`, { force: true })));
		await writeFile(`/data/npmplus/avatar/${user.id}.${ext}`, file.buffer);
		await userModel.query().patchAndFetchById(user.id, { avatar: `/images/avatar/${user.id}.${ext}` });
		return internalUser.update(access, { id: user.id });
	},

	deleteAvatar: async (access, id) => {
		await access.can("users:update", id);
		const user = await internalUser.get(access, { id });
		await Promise.all(avatarExts.map((e) => rm(`/data/npmplus/avatar/${user.id}.${e}`, { force: true })));
		await userModel.query().patchAndFetchById(user.id, { avatar: "" });
		return internalUser.update(access, { id: user.id });
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

		try {
			await access.can("users:permissions", data.id);
		} catch {
			delete data.roles;
		}

		await access.can("users:update", data.id);
		const existingUser = await internalUser.get(access, { id: data.id });
		// 2. if email is to be changed, find other users with that email
		if (typeof data.email !== "undefined") {
			data.email = data.email.toLowerCase().trim();

			if (existingUser.email !== data.email && !(await internalUser.isEmailAvailable(data.email, data.id))) {
				throw new errs.ValidationError(`Email address already in use - ${data.email}`);
			}
		}

		if (existingUser.id !== data.id) {
			// Sanity check that something crazy hasn't happened
			throw new errs.InternalValidationError(
				`User could not be updated, IDs do not match: ${existingUser.id} !== ${data.id}`,
			);
		}

		if (existingUser.avatar?.startsWith("/images/avatar/")) {
			data.avatar = existingUser.avatar;
		} else if (process.env.DISABLE_GRAVATAR === "true") {
			data.avatar = "/images/default-avatar.jpg";
		} else {
			try {
				const hash = crypto
					.createHash("sha256")
					.update((data.email || existingUser.email).trim().toLowerCase())
					.digest("hex");
				const response = await fetch(
					`https://www.gravatar.com/avatar/${hash}?s=64&default=initials&name=${encodeURIComponent(
						(data.name || existingUser.name)
							.split(" ")
							.map((n) => n[0])
							.join(""),
					)}`,
					{
						headers: {
							"User-Agent": `NPMplus/${pjson.version}`,
						},
					},
				);

				if (!response.ok) throw new Error(`Status code: ${response.status}`);

				let ext;
				switch (response.headers.get("content-type")) {
					case "image/png":
						ext = "png";
						break;
					case "image/jpeg":
						ext = "jpg";
						break;
					case "image/gif":
						ext = "gif";
						break;
					default:
						throw new Error(`Unsupported content-type: ${response.headers.get("content-type")}`);
				}

				const buffer = await response.arrayBuffer();
				await writeFile(`/data/npmplus/gravatar/${hash}.${ext}`, Buffer.from(buffer));

				data.avatar = `/images/gravatar/${hash}.${ext}`;
			} catch (err) {
				logger.error(`Error downloading gravatar: ${err.message}`);
				data.avatar = "/images/default-avatar.jpg";
			}
		}

		await userModel.query().patchAndFetchById(existingUser.id, data);
		const user = await internalUser.get(access, { id: data.id });

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

		const row = utils.omitRow(omissions())(await query);
		if (!row?.id) {
			throw new errs.ItemNotFoundError(thisData.id);
		}

		if (row.id === access.token.getUserId(0)) {
			row.goaccess = process.env.GOA === "true" && row.roles.includes("admin");
		}
		// Custom omissions
		if (typeof thisData.omit !== "undefined" && thisData.omit !== null) {
			return _.omit(row, thisData.omit);
		}

		if (row.avatar === "") {
			row.avatar = "/images/default-avatar.jpg";
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

		await internalAuditLog.add(access, {
			action: "deleted",
			object_type: "user",
			object_id: user.id,
			meta: _.omit(user, omissions()),
		});

		return true;
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
				identity: user.email.toLowerCase().trim(),
				secret: data.current,
			});
		}

		const existing_auth = await authModel.query().where("user_id", user.id).andWhere("type", data.type).first();

		if (existing_auth) {
			await authModel.query().where("user_id", user.id).andWhere("type", data.type).patch({
				type: data.type, // This is required for the model to encrypt on save
				secret: data.secret,
			});
		} else {
			await authModel.query().insert({
				user_id: user.id,
				type: data.type,
				secret: data.secret,
				meta: {},
			});
		}

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

		let permissions;

		const existing_auth = await userPermissionModel.query().where("user_id", user.id).first();

		if (existing_auth) {
			permissions = await userPermissionModel
				.query()
				.where("user_id", user.id)
				.patchAndFetchById(existing_auth.id, { user_id: user.id, ...data });
		} else {
			permissions = await userPermissionModel.query().insertAndFetch({ user_id: user.id, ...data });
		}

		await internalAuditLog.add(access, {
			action: "updated",
			object_type: "user",
			object_id: user.id,
			meta: {
				name: user.name,
				permissions,
			},
		});

		return true;
	},

	revokeSessions: async (access, userId) => {
		await access.can("users:revoke", userId);
		await userModel
			.query()
			.where("id", userId)
			.patch({ npmplus_token_valid_after: Math.floor(Date.now() / 1000) });
		return true;
	},
};

export default internalUser;
