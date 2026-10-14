import { readdir, rm } from "node:fs/promises";
import errs from "../lib/error.js";
import { access as logger } from "../logger.js";
import accessListModel from "../models/access_list.js";
import internalAccessList from "./access-list.js";

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

const getHostFilePrefix = (proxyHost) => `host-${proxyHost.id}`;

/**
 *
 * @param {*} proxyHost
 * @returns
 */
const getProxyHostFilename = (proxyHost) => `${GENERATED_DIR}/${getHostFilePrefix(proxyHost)}`;

/**
 *
 * @param {*} proxyHost
 * @param {*} location
 * @returns
 */
const getProxyLocationFilename = (proxyHost, location) =>
	`${GENERATED_DIR}/${getHostFilePrefix(proxyHost)}-location-${location.id}`;

const findHostFiles = async (proxyHost) => {
	const prefix = getHostFilePrefix(proxyHost);
	const entries = await readdir(GENERATED_DIR, { withFileTypes: true });

	return entries
		.filter((entry) => entry.isFile() && (entry.name === prefix || entry.name.startsWith(`${prefix}-`)))
		.map((entry) => `${GENERATED_DIR}/${entry.name}`);
};

const writeHtpasswdFile = async (filename, items, label) => {
	logger.info(`Building multi Access file ${filename} for: ${label}`);

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

	if (effectiveAccess.items.length === 0) return; // don't create an empty file
	await writeHtpasswdFile(getProxyHostFilename(proxyHost), effectiveAccess.items, `proxy host #${proxyHost.id}`);
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

	if (effectiveAccess.items.length === 0) return; // don't create an empty file
	await writeHtpasswdFile(
		getProxyLocationFilename(proxyHost, location),
		effectiveAccess.items,
		`proxy host #${proxyHost.id} location #${location.id}`,
	);
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
			satisfy_any: Boolean(first?.satisfy_any),
			pass_auth: Boolean(first?.pass_auth),
			source_acl_ids: lists.map((l) => l.id).filter((id) => Number.isInteger(id)),
		};
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
		if (host_type !== "proxy_host") {
			return;
		}

		// cleanup all old files for this host and regenerate
		await internalProxyHostAccessList.delete(proxyHost);

		await buildHostFile(proxyHost, proxyHost.access_lists ?? []);

		for (const location of proxyHost.locations || []) {
			// global will use the host file name anyway
			if (location.npmplus_access_list_type === "custom") {
				await buildLocationFile(proxyHost, location, location.access_lists ?? []);
			}
		}
	},

	/**
	 * Ensures the provided acls are valid (if custom, at least 1 acl must be specified)
	 * @param {Access} access
	 * @param {*} proxyHost
	 * @returns
	 */
	validateAccessLists: async (access, proxyHost) => {
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
		// make sure no ACLs that are being uploaded have been deleted
		if (aclIds.size > 0) {
			const query = accessListModel
				.query()
				.whereIn("id", [...aclIds])
				.select("id");

			if (access.visibility !== "all") {
				query.andWhere("owner_user_id", access.token.getUserId(1));
			}

			if (!aclIds.isSubsetOf(new Set((await query).map((row) => row.id)))) {
				throw new errs.ValidationError("One or more selected Access Lists no longer exist");
			}
		}
	},

	/**
	 * used by the create/update functions of proxy_host, this sets the npmplus_access_list_ids
	 * @param {Object} proxyHost
	 * @returns {Object}
	 */
	cleanAccessListTypes(proxyHost) {
		const getAccessListIds = (item) => {
			if (item.npmplus_access_list_type === "custom") {
				return item.npmplus_access_list_ids ?? item.access_lists?.map(({ id }) => id) ?? [];
			}
			return [];
		};

		proxyHost.npmplus_access_list_ids = getAccessListIds(proxyHost);
		for (const location of proxyHost.locations ?? []) location.npmplus_access_list_ids = getAccessListIds(location);
		return proxyHost;
	},
};

export default internalProxyHostAccessList;
