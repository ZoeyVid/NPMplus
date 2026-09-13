export const ADMIN = "admin";
const VISIBILITY = "visibility";
export const PROXY_HOSTS = "proxyHosts";
export const REDIRECTION_HOSTS = "redirectionHosts";
export const DEAD_HOSTS = "deadHosts";
export const STREAMS = "streams";
export const CERTIFICATES = "certificates";
export const ACCESS_LISTS = "accessLists";

export const MANAGE = "manage";
export const VIEW = "view";
const HIDDEN = "hidden";

const hasPermission = (section, perm, userPerms, roles) => {
	if (!userPerms) return false;
	if (isAdmin(roles)) return true;
	const acceptable = [MANAGE, perm];
	// @ts-expect-error 7053
	const v = typeof userPerms[section] !== "undefined" ? userPerms[section] : HIDDEN;
	return acceptable.indexOf(v) !== -1;
};

const isAdmin = (roles) => roles?.includes("admin") || false;

export { hasPermission };
