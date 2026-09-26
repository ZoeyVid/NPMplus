import crypto from "node:crypto";
import { rm, writeFile } from "node:fs/promises";
import errs from "../lib/error.js";
import { gravatar as logger } from "../logger.js";
import authModel from "../models/auth.js";
import userModel from "../models/user.js";
import userPermissionModel from "../models/user_permission.js";
import pjson from "../package.json" with { type: "json" };
import internalAuditLog from "./audit-log.js";
import internalToken from "./token.js";

const avatarExts = ["png", "jpg", "gif", "webp"];

const avatarExt = (b) => {
	if (!b || b.length < 12) return null;
	if (b.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) return "png";
	if (b.subarray(0, 3).equals(Buffer.from("ffd8ff", "hex"))) return "jpg";
	if (b.subarray(0, 4).toString("latin1") === "GIF8") return "gif";
	if (b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") {
		return "webp";
	}
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

		data.email = data.email.toLowerCase();

		if (typeof data.is_disabled !== "undefined") {
			data.is_disabled = data.is_disabled ? 1 : 0;
		}

		access.canAdmin();

		if (!(await internalUser.isEmailAvailable(data.email))) {
			throw new errs.ValidationError(`Email address already in use - ${data.email}`);
		}

		let user = await userModel.query().insertAndFetch(data);
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
			proxy_hosts: "hidden",
			redirection_hosts: "hidden",
			dead_hosts: "hidden",
			streams: "hidden",
			access_lists: "hidden",
			certificates: "hidden",
		});

		await userModel
			.query()
			.patchAndFetchById(user.id, { avatar: await internalUser.fetchGravatar(user.id, user.email, user.name) });

		user = await internalUser.get(access, { id: user.id });

		await internalAuditLog.add(access, {
			action: "created",
			object_type: "user",
			object_id: user.id,
			meta: user,
		});

		return user;
	},

	fetchGravatar: async (id, email, name) => {
		if (process.env.DISABLE_GRAVATAR === "true") return "/images/default-avatar.jpg";
		try {
			const hash = crypto.createHash("sha256").update(email.toLowerCase()).digest("hex");
			const response = await fetch(
				`https://www.gravatar.com/avatar/${hash}?s=64&default=initials&name=${encodeURIComponent(
					name
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

			const buffer = Buffer.from(await response.arrayBuffer());
			const ext = avatarExt(buffer);
			if (!ext) throw new Error("Unsupported image format");

			for (const e of avatarExts) await rm(`/data/npmplus/gravatar/${id}.${e}`, { force: true });
			await writeFile(`/data/npmplus/gravatar/${id}.${ext}`, buffer);

			return `/images/gravatar/${id}.${ext}`;
		} catch (err) {
			logger.error(`Error downloading gravatar: ${err.message}`);
			return "/images/default-avatar.jpg";
		}
	},

	setAvatar: async (access, id, file) => {
		access.canUser(id);
		const ext = avatarExt(file?.buffer);
		if (!ext) throw new errs.ValidationError("Invalid avatar file type");
		const user = await internalUser.get(access, { id });
		for (const e of avatarExts) await rm(`/data/npmplus/avatar/${user.id}.${e}`, { force: true });
		await writeFile(`/data/npmplus/avatar/${user.id}.${ext}`, file.buffer);
		await userModel.query().patchAndFetchById(user.id, { avatar: `/images/avatar/${user.id}.${ext}` });
		const savedUser = await internalUser.get(access, { id: user.id });

		await internalAuditLog.add(access, {
			action: "updated",
			object_type: "user",
			object_id: savedUser.id,
			meta: { ...savedUser, avatar_changed: true },
		});

		return savedUser;
	},

	deleteAvatar: async (access, id) => {
		access.canUser(id);
		const user = await internalUser.get(access, { id });
		for (const e of avatarExts) await rm(`/data/npmplus/avatar/${user.id}.${e}`, { force: true });
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

		access.canUser(data.id);
		try {
			access.canAdmin();
		} catch {
			delete data.roles;
		}
		const existingUser = await internalUser.get(access, { id: data.id });
		// 2. if email is to be changed, find other users with that email
		if (typeof data.email !== "undefined") {
			data.email = data.email.toLowerCase();

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
		} else {
			data.avatar = await internalUser.fetchGravatar(
				existingUser.id,
				data.email || existingUser.email,
				data.name || existingUser.name,
			);
		}

		await userModel.query().patchAndFetchById(existingUser.id, data);
		const user = await internalUser.get(access, { id: data.id });

		await internalAuditLog.add(access, {
			action: "updated",
			object_type: "user",
			object_id: user.id,
			meta: user,
		});

		return user;
	},

	/**
	 * @param  {Access}   access
	 * @param  {Object}   [data]
	 * @param  {Integer}  [data.id]          Defaults to the token user
	 * @param  {Array}    [data.expand]
	 * @return {Promise}
	 */
	get: async (access, data) => {
		const thisData = data || {};

		if (typeof thisData.id === "undefined" || !thisData.id) {
			thisData.id = access.token.getUserId(0);
		}

		access.canUser(thisData.id);

		const query = userModel
			.query()
			.where("is_deleted", 0)
			.andWhere("id", thisData.id)
			.allowGraph("[permissions]")
			.first();

		if (typeof thisData.expand !== "undefined" && thisData.expand !== null) {
			query.withGraphFetched(`[${thisData.expand.join(", ")}]`);
		}

		const row = await query;
		if (!row?.id) {
			throw new errs.ItemNotFoundError(thisData.id);
		}

		if (row.id === access.token.getUserId(0)) {
			row.goaccess = process.env.GOA === "true" && row.roles.includes("admin");
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
		const query = userModel.query().where("email", "=", email.toLowerCase()).where("is_deleted", 0).first();

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
		access.canAdmin();

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
			meta: user,
		});

		return user;
	},

	/**
	 * This will only count the users
	 *
	 * @param   {Access}  access
	 * @param   {String}  [search_query]
	 * @returns {*}
	 */
	getCount: async (access, search_query) => {
		access.canAdmin();

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
	 * @param   {String}  [search_query]
	 * @returns {Promise}
	 */
	getAll: async (access, search_query) => {
		access.canAdmin();
		const query = userModel.query().where("is_deleted", 0).groupBy("id").orderBy("name", "ASC");

		// Query is used for searching
		if (typeof search_query === "string") {
			query.where(function () {
				this.where("name", "like", `%${search_query}%`).orWhere("email", "like", `%${search_query}%`);
			});
		}

		return await query;
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
		access.canUser(data.id);

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
				identity: user.email.toLowerCase(),
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

		await userModel
			.query()
			.where("id", user.id)
			.patch({ npmplus_token_valid_after: Math.floor(Date.now() / 1000) });

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
		access.canAdmin();

		const user = await internalUser.get(access, { id: data.id });
		if (user.id !== data.id) {
			// Sanity check that something crazy hasn't happened
			throw new errs.InternalValidationError(
				`User could not be updated, IDs do not match: ${user.id} !== ${data.id}`,
			);
		}

		let permissions;

		const { id, ...permissionData } = data;
		const existing_auth = await userPermissionModel.query().where("user_id", user.id).first();

		const merged = { ...existing_auth, ...permissionData };
		if (merged.proxy_hosts !== "hidden" && merged.access_lists === "hidden") {
			throw new errs.ValidationError("Access lists can not be hidden while proxy hosts are visible");
		}
		if (
			merged.certificates === "hidden" &&
			["proxy_hosts", "redirection_hosts", "dead_hosts", "streams"].some((type) => merged[type] !== "hidden")
		) {
			throw new errs.ValidationError("Certificates can not be hidden while hosts are visible");
		}

		if (existing_auth) {
			permissions = await userPermissionModel
				.query()
				.where("user_id", user.id)
				.patchAndFetchById(existing_auth.id, { user_id: user.id, ...permissionData });
		} else {
			permissions = await userPermissionModel.query().insertAndFetch({ user_id: user.id, ...permissionData });
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
		access.canUser(userId);
		const user = await userModel
			.query()
			.patchAndFetchById(userId, { npmplus_token_valid_after: Math.floor(Date.now() / 1000) });

		await internalAuditLog.add(access, {
			action: "updated",
			object_type: "user",
			object_id: user.id,
			meta: {
				name: user.name,
				sessions_revoked: true,
			},
		});

		return true;
	},
};

export default internalUser;
