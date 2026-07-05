import { rm, readdir } from "node:fs/promises";
import { access as logger } from "../logger.js";
import errs from "../lib/error.js";
import accessListModel from "../models/access_list.js";
import internalAccessList from "./access-list.js";
import internalNginx from "./nginx.js";

const GENERATED_DIR = "/data/access";

const getMergedItems = (accessLists) => {
	const seen = new Set();
	const merged = [];

	for (const accessList of accessLists || []) {
		for (const item of accessList.items || []) {
			if (item.username && item.password && !seen.has(item.username)) {
				seen.add(item.username);
				merged.push(item);
			}
		}
	}
	return merged;
};

const getHostFilePrefix = (proxyHost) => {
	return `host-${proxyHost.id}`;
};

/**
 *
 * @param {*} proxyHost
 * @returns
 */
const getProxyHostFilename = (proxyHost) => {
	return `${GENERATED_DIR}/${getHostFilePrefix(proxyHost)}`;
};

/**
 *
 * @param {*} proxyHost
 * @param {*} location
 * @returns
 */
const getProxyLocationFilename = (proxyHost, location) => {
	return `${GENERATED_DIR}/${getHostFilePrefix(proxyHost)}-location-${location.id}`;
};

const findHostFiles = async (proxyHost) => {
	const prefix = getHostFilePrefix(proxyHost);
	const entries = await readdir(GENERATED_DIR, { withFileTypes: true });

	return entries
		.filter((entry) => entry.isFile() && (entry.name === prefix || entry.name.startsWith(`${prefix}-`)))
		.map((entry) => `${GENERATED_DIR}/${entry.name}`);
};

const writeHtpasswdFile = async (filename, items, label) => {
	logger.info(`Building multi Access file ${filename} for: ${label}`);

	await rm(filename, { force: true });

	await internalAccessList.writeData(filename, items);
	logger.success(`Built merged Access file ${filename} for: ${label}`);
};

/**
 *
 * @param {*} proxyHost
 * @param {*} accessLists
 * @returns
 */
const buildHostFile = async (proxyHost, accessLists) => {
	if (accessLists.length < 2) {
		// if size is 1 then use the default acl file. If empty, nothing to generate
		return;
	}
	const effectiveAccess = internalProxyHostAccessList.buildAclFile(accessLists);
	const filename = getProxyHostFilename(proxyHost);

	if (!effectiveAccess.items.length) {
		await rm(filename, { force: true });
		return; // don't create an empty file
	}
	await writeHtpasswdFile(filename, effectiveAccess.items, `proxy host #${proxyHost.id}`);
};

/**
 *
 * @param {*} proxyHost
 * @param {*} location
 * @param {*} accessLists
 * @returns
 */
const buildLocationFile = async (proxyHost, location, accessLists) => {
	if (accessLists.length < 2) {
		// if size is 1 then use the default acl file. If empty, nothing to generate
		return;
	}
	const effectiveAccess = internalProxyHostAccessList.buildAclFile(accessLists);
	const filename = getProxyLocationFilename(proxyHost, location);

	if (!effectiveAccess.items.length) {
		await rm(filename, { force: true });
		return; // don't create an empty file
	}
	await writeHtpasswdFile(filename, effectiveAccess.items, `proxy host #${proxyHost.id} location #${location.id}`);
};

const internalProxyHostAccessList = {
	/**
	 *
	 * @param {*} list
	 * @returns
	 */
	buildAclFile: (list) => {
		const lists = list || [];
		const first = lists[0] || null; // satisfy any/pass auth need to be specified in the first acl

		const last = (first?.clients || []).at(-1);
		const catchAll =
			last?.directive === "allow" && last?.address?.trim().toLowerCase() === "all"
				? { directive: "allow", address: "all" }
				: { directive: "deny", address: "all" };

		const specificRules = lists
			.flatMap((l) => l.clients || [])
			.filter((c) => c.address?.trim().toLowerCase() !== "all");
		const clients = specificRules.length === 0 ? [] : [...specificRules, catchAll];
		return {
			items: getMergedItems(lists),
			clients,
			satisfy_any: first ? !!first.satisfy_any : false,
			pass_auth: first ? !!first.pass_auth : false,
			source_acl_ids: lists.map((list) => list.id).filter((id) => Number.isInteger(id)),
		};
	},

	/**
	 * Reorders the accessLists objects based on the order of the IDs (which is required for generation)
	 * @param {*} accessLists
	 * @param {*} ids
	 * @returns
	 */
	orderAccessListsByIds: (accessLists, ids) => {
		const byId = new Map((accessLists || []).map((acl) => [acl.id, acl]));
		return (ids || []).map((id) => byId.get(id)).filter(Boolean);
	},

	/**
	 *
	 * @param {*} proxyHostId
	 * @param {*} data
	 * @returns
	 */
	getAccessListRelationRows: (proxyHostId, data) => {
		const relationIds = new Set();

		// perform data sanitisation
		if (data.npmplus_access_list_type === "custom" && Array.isArray(data.npmplus_access_list_ids)) {
			data.npmplus_access_list_ids.forEach((id) => {
				if (Number.isInteger(id) && id > 0) {
					relationIds.add(id);
				}
			});
		}

		// since locations is stored as a json, extract it and flatten it to store in the join table
		if (Array.isArray(data.locations)) {
			data.locations.forEach((location) => {
				if (location.npmplus_access_list_type === "custom" && Array.isArray(location.npmplus_access_list_ids)) {
					location.npmplus_access_list_ids.forEach((id) => {
						if (Number.isInteger(id) && id > 0) {
							relationIds.add(id);
						}
					});
				}
			});
		}
		// now map the acls to proxy hosts
		return Array.from(relationIds).map((access_list_id) => ({
			proxy_host_id: proxyHostId,
			access_list_id,
		}));
	},

	/**
	 * Updates the npmplus_proxy_host_access_list database table to match the data stored in the object
	 * @param {*} trx
	 * @param {*} proxyHostId
	 * @param {*} data
	 */
	syncAccessListRelations: async (trx, proxyHostId, data) => {
		const desiredRows = internalProxyHostAccessList.getAccessListRelationRows(proxyHostId, data);
		const desiredIds = new Set(desiredRows.map((row) => row.access_list_id));

		const existingRows = await trx("npmplus_proxy_host_access_list")
			.where("proxy_host_id", proxyHostId)
			.select("access_list_id");

		const existingIds = new Set(existingRows.map((row) => row.access_list_id));

		const idsToInsert = [...desiredIds].filter((id) => !existingIds.has(id));
		const idsToDelete = [...existingIds].filter((id) => !desiredIds.has(id));

		if (idsToInsert.length > 0) {
			await trx("npmplus_proxy_host_access_list").insert(
				idsToInsert.map((access_list_id) => ({
					proxy_host_id: proxyHostId,
					access_list_id,
				})),
			);
		}

		if (idsToDelete.length > 0) {
			await trx("npmplus_proxy_host_access_list")
				.where("proxy_host_id", proxyHostId)
				.whereIn("access_list_id", idsToDelete)
				.delete();
		}
	},

	/**
	 *
	 * @param {*} proxyHost
	 */
	delete: async (proxyHost) => {
		const oldFiles = await findHostFiles(proxyHost);
		for (const file of oldFiles) {
			await rm(file, { force: true });
		}
	},

	/**
	 *
	 * @param {*} proxyHost
	 * @returns
	 */
	getHostFileName: (proxyHost) => {
		if (proxyHost.npmplus_access_list_type === "custom") {
			const accessLists = Array.isArray(proxyHost.access_lists) ? proxyHost.access_lists : [];
			if (accessLists.length === 1) {
				return internalAccessList.getFilename(accessLists[0]);
			}
			return getProxyHostFilename(proxyHost);
		}
		return "";
	},

	/**
	 *
	 * @param {*} proxyHost
	 * @param {*} location
	 * @returns
	 */
	getLocationFileName: (proxyHost, location) => {
		if (location.npmplus_access_list_type === "global") {
			return internalProxyHostAccessList.getHostFileName(proxyHost);
		}
		if (location.npmplus_access_list_type === "custom") {
			const accessLists = Array.isArray(location.access_lists) ? location.access_lists : [];
			if (accessLists.length === 1) {
				return internalAccessList.getFilename(accessLists[0]);
			}
			return getProxyLocationFilename(proxyHost, location);
		}
		return "";
	},

	/**
	 * Generates the output htpasswd file on the filesystem
	 * @param {*} proxyHost
	 */
	build: async (host_type, proxyHost) => {
		if (internalNginx.getFileFriendlyHostType(host_type) !== "proxy_host") {
			return;
		}
		// order as specified in the UI
		const hostAccessLists = internalProxyHostAccessList.orderAccessListsByIds(
			Array.isArray(proxyHost.access_lists) ? proxyHost.access_lists : [],
			proxyHost.npmplus_access_list_ids,
		);

		// cleanup all old files for this host and regenerate
		await internalProxyHostAccessList.delete(proxyHost);

		await buildHostFile(proxyHost, hostAccessLists);

		for (const location of proxyHost.locations || []) {
			// global will use the host file name anyway
			if (location.npmplus_access_list_type === "custom") {
				// order as specified in the UI
				const locationAccessLists = internalProxyHostAccessList.orderAccessListsByIds(
					location.access_lists || [],
					location.npmplus_access_list_ids,
				);
				await buildLocationFile(proxyHost, location, locationAccessLists);
			}
		}
	},

	/**
	 * Masks the access lists in the locations and the proxy host
	 * @param {*} proxyHost
	 * @returns
	 */
	maskAccessListItems: (proxyHost) => {
		if (!proxyHost) {
			return proxyHost;
		}

		const maskAccessList = (accessList) =>
			internalAccessList.maskItems({
				...accessList,
				items: Array.isArray(accessList.items)
					? accessList.items.map((item) => ({ ...item }))
					: accessList.items,
			});

		if (Array.isArray(proxyHost.access_lists)) {
			proxyHost.access_lists = proxyHost.access_lists.map(maskAccessList);
		}

		if (Array.isArray(proxyHost.locations)) {
			proxyHost.locations = proxyHost.locations.map((location) => ({
				...location,
				access_lists: Array.isArray(location.access_lists)
					? location.access_lists.map(maskAccessList)
					: location.access_lists,
			}));
		}

		return proxyHost;
	},

	/**
	 * Populates the access_lists object in proxyHost and proxyHost.locations with the actual object
	 * data
	 * @param {*} proxyHost
	 * @returns
	 */
	populateLocationAccessLists: async (proxyHost) => {
		if (!proxyHost || !Array.isArray(proxyHost.locations) || proxyHost.locations.length === 0) {
			return proxyHost;
		}

		const allIds = [
			...new Set(
				proxyHost.locations.flatMap((location) =>
					location.npmplus_access_list_type === "custom" && Array.isArray(location.npmplus_access_list_ids)
						? location.npmplus_access_list_ids
						: [],
				),
			),
		];

		if (allIds.length === 0) {
			proxyHost.locations = proxyHost.locations.map((location) => ({
				...location,
				access_lists: [],
			}));
			return proxyHost;
		}

		const rows = await accessListModel
			.query()
			.whereIn("id", allIds)
			.andWhere("is_deleted", 0)
			.withGraphFetched("[clients,items]");

		const byId = new Map(rows.map((row) => [row.id, row]));

		proxyHost.locations = proxyHost.locations.map((location) => {
			const ids = Array.isArray(location.npmplus_access_list_ids) ? location.npmplus_access_list_ids : [];

			return {
				...location,
				access_lists: ids.map((id) => byId.get(id)).filter(Boolean),
			};
		});
		return proxyHost;
	},

	/**
	 * Ensures the provided acls are valid (if custom, at least 1 acl must be specified)
	 * @param {*} proxyHost
	 * @returns
	 */
	validateAccessLists: async (proxyHost) => {
		if (!proxyHost) {
			return;
		}
		const aclIds = new Set(); // make sure no ACLs are being submitted that have been deleted
		const validateCustomSelection = (accessListType, accessListIds) => {
			if (accessListType === "custom") {
				if (!Array.isArray(accessListIds) || accessListIds.length === 0) {
					throw new errs.ValidationError(
						"Custom Access Lists require at least 1 access list to be specified",
					);
				}
				// This should never happen unless a different frontend is used. Proper deduplication happens later
				if (new Set(accessListIds).size !== accessListIds.length) {
					throw new errs.ValidationError("Duplicate Access Lists Found");
				}
				for (const id of accessListIds) {
					aclIds.add(id);
				}
			}
		};

		validateCustomSelection(proxyHost.npmplus_access_list_type, proxyHost.npmplus_access_list_ids);
		if (Array.isArray(proxyHost.locations)) {
			for (const location of proxyHost.locations) {
				validateCustomSelection(location.npmplus_access_list_type, location.npmplus_access_list_ids);
			}
		}
		// make sure no ACLs that are being uploaded have been soft deleted
		if (aclIds.size > 0) {
			const rows = await accessListModel
				.query()
				.whereIn("id", [...aclIds])
				.andWhere("is_deleted", 0)
				.select("id");

			const validIds = new Set(rows.map((row) => row.id));
			const invalidIds = [...aclIds].filter((id) => !validIds.has(id));

			if (invalidIds.length > 0) {
				throw new errs.ValidationError("One or more selected Access Lists no longer exist");
			}
		}
	},

	/**
	 * used by the get/update functions of proxy_host and access_list, this sets the npmplus_access_list_ids
	 * @param {Object} proxyHost
	 * @returns {Object}
	 */
	cleanAccessListTypes(proxyHost) {
		if (!proxyHost) {
			return proxyHost;
		}

		// ensure array exists
		if (!Array.isArray(proxyHost.npmplus_access_list_ids)) {
			proxyHost.npmplus_access_list_ids = [];
		}

		// fallback from old column (only if needed)
		if (
			typeof proxyHost.npmplus_access_list_type === "undefined" &&
			proxyHost.npmplus_access_list_ids.length === 0 &&
			proxyHost.access_list_id &&
			proxyHost.access_list_id !== 0
		) {
			proxyHost.npmplus_access_list_ids = [proxyHost.access_list_id];
			proxyHost.npmplus_access_list_type = "custom";
		}

		// ensure type exists
		if (!proxyHost.npmplus_access_list_type) {
			proxyHost.npmplus_access_list_type = "public";
			proxyHost.npmplus_access_list_ids = [];
		}

		if (Array.isArray(proxyHost.locations)) {
			// generate the ids for a location (this is only used for the htpasswd file tracking with multi acls)
			const existingIds = proxyHost.locations.map((location) => location.id).filter((id) => Number.isInteger(id));
			let count = existingIds.length ? Math.max(...existingIds) + 1 : 0;
			// handle both snake and camel case
			proxyHost.locations = proxyHost.locations.map((location) => {
				if (!Number.isInteger(location.id)) {
					location.id = count++;
				}

				const accessListType = location.accessListType || location.npmplus_access_list_type || "global";
				const accessListIds =
					accessListType !== "custom"
						? []
						: Array.isArray(location.accessListIds)
							? location.accessListIds
							: Array.isArray(location.npmplus_access_list_ids)
								? location.npmplus_access_list_ids
								: [];
				const { accessListIds: _accessListIds, accessListType: _accessListType, ...otherParameters } = location;

				return {
					...otherParameters,
					npmplus_access_list_ids: accessListIds,
					npmplus_access_list_type: accessListType,
				};
			});
		}
		return proxyHost;
	},
};

export default internalProxyHostAccessList;
