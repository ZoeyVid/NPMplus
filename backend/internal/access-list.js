import { unlink, rm, writeFile, appendFile } from "node:fs/promises";
import bcrypt from "bcryptjs";
import _ from "lodash";
import errs from "../lib/error.js";
import utils from "../lib/utils.js";
import { access as logger } from "../logger.js";
import accessListModel from "../models/access_list.js";
import accessListAuthModel from "../models/access_list_auth.js";
import accessListClientModel from "../models/access_list_client.js";
import proxyHostModel from "../models/proxy_host.js";
import internalAuditLog from "./audit-log.js";
import internalNginx from "./nginx.js";
import internalProxyHostAccessList from "./proxy-host-access-list.js";

const omissions = () => {
	return ["is_deleted"];
};

const internalAccessList = {
	/**
	 * @param   {Access}  access
	 * @param   {Object}  data
	 * @returns {Promise}
	 */
	create: async (access, data) => {
		await access.can("access_lists:create", data);
		const row = await accessListModel
			.query()
			.insertAndFetch({
				name: data.name,
				satisfy_any: data.satisfy_any,
				pass_auth: data.pass_auth,
				owner_user_id: access.token.getUserId(1),
			})
			.then(utils.omitRow(omissions()));

		data.id = row.id;

		const promises = [];
		// Items
		data.items.map((item) => {
			promises.push(
				accessListAuthModel.query().insert({
					access_list_id: row.id,
					username: item.username,
					password: bcrypt.hashSync(item.password, 6),
				}),
			);
			return true;
		});

		await Promise.all(promises);

		// Clients
		for (const client of data.clients ?? []) {
			await accessListClientModel.query().insert({
				access_list_id: row.id,
				address: client.address,
				directive: client.directive,
			});
		}

		// re-fetch with expansions
		const freshRow = await internalAccessList.get(
			access,
			{
				id: data.id,
				expand: ["owner", "items", "clients", "proxy_hosts.[access_lists.[clients,items]]"],
			},
			true, // skip masking
		);

		// Audit log
		data.meta = _.assign({}, data.meta || {}, freshRow.meta);
		await internalAccessList.build(freshRow);
		if (Number.parseInt(freshRow.proxy_host_count, 10)) {
			// locations don't have accessList objects, only IDs, so populate it with the object itself
			freshRow.proxy_hosts = await Promise.all(
				(freshRow.proxy_hosts || []).map((host) => {
					const cleanedHost = internalProxyHostAccessList.cleanAccessListTypes(host);
					return internalProxyHostAccessList.populateLocationAccessLists(cleanedHost);
				}),
			);
			await internalNginx.bulkGenerateConfigs(proxyHostModel, "proxy_host", freshRow.proxy_hosts);
		}

		// Add to audit log
		await internalAuditLog.add(access, {
			action: "created",
			object_type: "access-list",
			object_id: freshRow.id,
			meta: internalAccessList.maskItems(data),
		});

		if (Array.isArray(freshRow.proxy_hosts))
			freshRow.proxy_hosts = freshRow.proxy_hosts.map(internalProxyHostAccessList.maskAccessListItems);
		return internalAccessList.maskItems(freshRow);
	},

	/**
	 * @param  {Access}  access
	 * @param  {Object}  data
	 * @param  {Integer} data.id
	 * @param  {String}  [data.name]
	 * @param  {String}  [data.items]
	 * @return {Promise}
	 */
	update: async (access, data) => {
		await access.can("access_lists:update", data.id);
		const row = await internalAccessList.get(access, { id: data.id });
		if (row.id !== data.id) {
			// Sanity check that something crazy hasn't happened
			throw new errs.InternalValidationError(
				`Access List could not be updated, IDs do not match: ${row.id} !== ${data.id}`,
			);
		}

		// patch name if specified
		if (typeof data.name !== "undefined" && data.name) {
			await accessListModel.query().where({ id: data.id }).patch({
				name: data.name,
				satisfy_any: data.satisfy_any,
				pass_auth: data.pass_auth,
			});
		}

		// Check for items and add/update/remove them
		if (typeof data.items !== "undefined" && data.items) {
			const promises = [];
			const itemsToKeep = [];

			data.items.map((item) => {
				if (item.password) {
					promises.push(
						accessListAuthModel.query().insert({
							access_list_id: data.id,
							username: item.username,
							password: bcrypt.hashSync(item.password, 6),
						}),
					);
				} else {
					// This was supplied with an empty password, which means keep it but don't change the password
					itemsToKeep.push(item.username);
				}
				return true;
			});

			const query = accessListAuthModel.query().delete().where("access_list_id", data.id);

			if (itemsToKeep.length) {
				query.andWhere("username", "NOT IN", itemsToKeep);
			}

			await query;
			// Add new items
			if (promises.length) {
				await Promise.all(promises);
			}
		}

		// Check for clients and add/update/remove them
		if (typeof data.clients !== "undefined" && data.clients) {
			const query = accessListClientModel.query().delete().where("access_list_id", data.id);
			await query;

			for (const client of data.clients) {
				if (client.address) {
					await accessListClientModel.query().insert({
						access_list_id: data.id,
						address: client.address,
						directive: client.directive,
					});
				}
			}
		}

		// Add to audit log
		await internalAuditLog.add(access, {
			action: "updated",
			object_type: "access-list",
			object_id: data.id,
			meta: internalAccessList.maskItems(data),
		});

		// re-fetch with expansions
		const freshRow = await internalAccessList.get(
			access,
			{
				id: data.id,
				expand: ["owner", "items", "clients", "proxy_hosts.[certificate,access_lists.[clients,items]]"],
			},
			true, // skip masking
		);

		await internalAccessList.build(freshRow);
		if (Number.parseInt(freshRow.proxy_host_count, 10)) {
			// locations don't have accessList objects, only IDs, so populate it with the object itself
			freshRow.proxy_hosts = await Promise.all(
				(freshRow.proxy_hosts || []).map((host) => {
					const cleanedHost = internalProxyHostAccessList.cleanAccessListTypes(host);
					return internalProxyHostAccessList.populateLocationAccessLists(cleanedHost);
				}),
			);
			await internalNginx.bulkGenerateConfigs(proxyHostModel, "proxy_host", freshRow.proxy_hosts);
		}
		await internalNginx.reload();
		if (Array.isArray(freshRow.proxy_hosts))
			freshRow.proxy_hosts = freshRow.proxy_hosts.map(internalProxyHostAccessList.maskAccessListItems);
		return internalAccessList.maskItems(freshRow);
	},

	/**
	 * @param  {Access}   access
	 * @param  {Object}   data
	 * @param  {Integer}  data.id
	 * @param  {Array}    [data.expand]
	 * @param  {Array}    [data.omit]
	 * @param  {Boolean}  [skipMasking]
	 * @return {Promise}
	 */
	get: async (access, data, skipMasking) => {
		const thisData = data || {};
		const accessData = await access.can("access_lists:get", thisData.id);

		const query = accessListModel
			.query()
			.select("access_list.*", accessListModel.raw("COUNT(DISTINCT proxy_host.id) as proxy_host_count"))
			.leftJoin(
				"npmplus_proxy_host_access_list",
				"npmplus_proxy_host_access_list.access_list_id",
				"access_list.id",
			)
			.leftJoin("proxy_host", function () {
				this.on("proxy_host.id", "=", "npmplus_proxy_host_access_list.proxy_host_id").andOn(
					"proxy_host.is_deleted",
					"=",
					0,
				);
			})
			.where("access_list.is_deleted", 0)
			.andWhere("access_list.id", thisData.id)
			.groupBy("access_list.id")
			.allowGraph("[owner,items,clients,proxy_hosts.[certificate,access_lists.[clients,items]]]")
			.first();

		if (accessData.permission_visibility !== "all") {
			query.andWhere("access_list.owner_user_id", access.token.getUserId(1));
		}

		if (typeof thisData.expand !== "undefined" && thisData.expand !== null) {
			query.withGraphFetched(`[${thisData.expand.join(", ")}]`);
		}

		let row = await query.then(utils.omitRow(omissions()));

		if (!row?.id) {
			throw new errs.ItemNotFoundError(thisData.id);
		}
		if (!skipMasking && Array.isArray(row.proxy_hosts))
			row.proxy_hosts = row.proxy_hosts.map(internalProxyHostAccessList.maskAccessListItems);
		if (!skipMasking && typeof row.items !== "undefined" && row.items) {
			row = internalAccessList.maskItems(row);
		}
		// Custom omissions
		if (typeof data.omit !== "undefined" && data.omit !== null) {
			row = _.omit(row, data.omit);
		}

		return row;
	},

	/**
	 * @param   {Access}  access
	 * @param   {Object}  data
	 * @param   {Integer} data.id
	 * @param   {String}  [data.reason]
	 * @returns {Promise}
	 */
	delete: async (access, data) => {
		await access.can("access_lists:delete", data.id);
		const row = await internalAccessList.get(access, {
			id: data.id,
			expand: ["proxy_hosts.[certificate, access_lists.[clients,items]]", "items", "clients"],
		});

		if (!row?.id) {
			throw new errs.ItemNotFoundError(data.id);
		}
		// 1. update row to be deleted
		// 2. update any proxy hosts that were using it (ignoring permissions)
		// 3. reconfigure those hosts
		// 4. audit log

		// 1. update row to be deleted
		await accessListModel.query().where("id", row.id).patch({
			is_deleted: 1,
		});

		// 2. update any proxy hosts that were using it (ignoring permissions)
		const affectedHosts = (row.proxy_hosts || []).map((host) => {
			const updatedHost = { ...host };
			// check in case something crazy happened. This should never be the case, but safeguard
			if (!Array.isArray(updatedHost.npmplus_access_list_ids)) {
				updatedHost.npmplus_access_list_ids = [];
			}
			updatedHost.npmplus_access_list_ids = updatedHost.npmplus_access_list_ids.filter((id) => id !== row.id);

			// update the access_lists object (separate from the access_lists_ids)
			if (!Array.isArray(updatedHost.access_lists)) {
				updatedHost.access_lists = [];
			}
			updatedHost.access_lists = updatedHost.access_lists.filter((acl) => acl.id !== row.id);

			if (updatedHost.npmplus_access_list_ids.length === 0) {
				updatedHost.npmplus_access_list_type = "public";
			}
			// locations can be null specified by the schema
			if (updatedHost.locations == null) {
				updatedHost.locations = [];
			}
			if (!Array.isArray(updatedHost.locations)) {
				throw new errs.ConfigurationError("Invalid location structure. Expected an array");
			}
			updatedHost.locations = updatedHost.locations.map((location) => {
				const updatedLocation = { ...location };
				if (!Array.isArray(updatedLocation.npmplus_access_list_ids)) {
					updatedLocation.npmplus_access_list_ids = [];
				}
				updatedLocation.npmplus_access_list_ids = updatedLocation.npmplus_access_list_ids.filter(
					(id) => id !== row.id,
				);
				if (
					updatedLocation.npmplus_access_list_ids.length === 0 &&
					updatedLocation.npmplus_access_list_type === "custom"
				) {
					updatedLocation.npmplus_access_list_type = "global";
				}
				return updatedLocation;
			});
			return updatedHost;
		});
		// 3. Write the changes to the database and the config
		if (affectedHosts.length > 0) {
			await proxyHostModel.transaction(async (trx) => {
				await Promise.all(
					affectedHosts.map((host) => {
						return proxyHostModel
							.query(trx)
							.patchAndFetchById(host.id, {
								npmplus_access_list_ids: host.npmplus_access_list_ids,
								npmplus_access_list_type: host.npmplus_access_list_type,
								locations: host.locations,
							})
							.then(() => {
								return internalProxyHostAccessList.syncAccessListRelations(trx, host.id, host);
							});
					}),
				);
			});
			row.proxy_hosts = affectedHosts;
			// step 4. Regenerate configs and htpasswd files
			// locations don't have accessList objects, only IDs, so populate it with the object itself
			row.proxy_hosts = await Promise.all(
				(row.proxy_hosts || []).map((host) => {
					const cleanedHost = internalProxyHostAccessList.cleanAccessListTypes(host);
					return internalProxyHostAccessList.populateLocationAccessLists(cleanedHost);
				}),
			);
			await internalNginx.bulkGenerateConfigs(proxyHostModel, "proxy_host", row.proxy_hosts);
		}

		await internalNginx.reload();

		// delete the htpasswd file
		try {
			await unlink(internalAccessList.getFilename(row));
		} catch {
			// do nothing
		}

		// 4. audit log
		await internalAuditLog.add(access, {
			action: "deleted",
			object_type: "access-list",
			object_id: row.id,
			meta: _.omit(internalAccessList.maskItems(row), ["is_deleted", "proxy_hosts"]),
		});
		return true;
	},

	/**
	 * All Lists
	 *
	 * @param   {Access}  access
	 * @param   {Array}   [expand]
	 * @param   {String}  [searchQuery]
	 * @returns {Promise}
	 */
	getAll: async (access, expand, searchQuery) => {
		const accessData = await access.can("access_lists:list");

		const query = accessListModel
			.query()
			.select("access_list.*", accessListModel.raw("COUNT(DISTINCT proxy_host.id) as proxy_host_count"))
			.leftJoin(
				"npmplus_proxy_host_access_list",
				"npmplus_proxy_host_access_list.access_list_id",
				"access_list.id",
			)
			.leftJoin("proxy_host", function () {
				this.on("proxy_host.id", "=", "npmplus_proxy_host_access_list.proxy_host_id").andOn(
					"proxy_host.is_deleted",
					"=",
					0,
				);
			})
			.where("access_list.is_deleted", 0)
			.groupBy("access_list.id")
			.allowGraph("[owner,items,clients]")
			.orderBy("access_list.name", "ASC");

		if (accessData.permission_visibility !== "all") {
			query.andWhere("access_list.owner_user_id", access.token.getUserId(1));
		}

		// Query is used for searching
		if (typeof searchQuery === "string") {
			query.where(function () {
				this.where("name", "like", `%${searchQuery}%`);
			});
		}

		if (typeof expand !== "undefined" && expand !== null) {
			query.withGraphFetched(`[${expand.join(", ")}]`);
		}

		const rows = await query.then(utils.omitRows(omissions()));
		if (rows) {
			rows.forEach((row, idx) => {
				if (typeof row.items !== "undefined" && row.items) {
					rows[idx] = internalAccessList.maskItems(row);
				}
			});
		}
		return rows;
	},

	/**
	 * Count is used in reports
	 *
	 * @param   {Integer} userId
	 * @param   {String}  visibility
	 * @returns {Promise}
	 */
	getCount: async (userId, visibility) => {
		const query = accessListModel.query().count("id as count").where("is_deleted", 0);

		if (visibility !== "all") {
			query.andWhere("owner_user_id", userId);
		}

		const row = await query.first();
		return Number.parseInt(row.count, 10);
	},

	/**
	 * @param   {Object}  list
	 * @returns {Object}
	 */
	maskItems: (list) => {
		if (list && typeof list.items !== "undefined") {
			for (const item of list.items) item.password = "";
		}
		return list;
	},

	/**
	 * @param   {Object}  list
	 * @param   {Integer} list.id
	 * @returns {String}
	 */
	getFilename: (list) => {
		return `/data/access/${list.id}`;
	},

	/**
	 *
	 * @param {*} htpasswdFile
	 * @param {*} items
	 */
	writeData: async (htpasswdFile, items) => {
		await writeFile(htpasswdFile, "", { encoding: "utf8" });

		if (items?.length) {
			for (const item of items) {
				if (item.username?.length && item.password?.length) {
					logger.info(`Adding: ${item.username}`);

					try {
						await appendFile(htpasswdFile, `${item.username}:${item.password}\n`, {
							encoding: "utf8",
						});
					} catch (err) {
						logger.error(err);
						throw err;
					}
				}
			}
		}
	},

	/**
	 * @param   {Object}  list
	 * @param   {Integer} list.id
	 * @param   {String}  list.name
	 * @param   {Array}   list.items
	 * @returns {Promise}
	 */
	build: async (list) => {
		logger.info(`Building Access file #${list.id} for: ${list.name}`);

		const htpasswdFile = internalAccessList.getFilename(list);

		await rm(htpasswdFile, { force: true });
		await internalAccessList.writeData(htpasswdFile, list.items);

		logger.success(`Built Access file #${list.id} for: ${list.name}`);
	},
};

export default internalAccessList;
