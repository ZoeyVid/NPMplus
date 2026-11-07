export const ADMIN = "admin";
export const PROXY_HOSTS = "proxyHosts";
export const REDIRECTION_HOSTS = "redirectionHosts";
export const DEAD_HOSTS = "deadHosts";
export const STREAMS = "streams";
export const CERTIFICATES = "certificates";
export const ACCESS_LISTS = "accessLists";

export const MANAGE = "manage";
export const VIEW = "view";
const HIDDEN = "hidden";

const hasPermission = (section, perm, userPerms, isAdmin) => {
	if (isAdmin) return true;
	if (!userPerms) return false;
	// @ts-expect-error 7053
	return [MANAGE, perm].includes(userPerms[section] ?? HIDDEN);
};

export { hasPermission };
