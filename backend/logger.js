const TYPES = {
	info: ["ℹ", "info"],
	warn: ["⚠", "warning"],
	error: ["✖", "error"],
	success: ["✔", "success"],
	start: ["▶", "start"],
	complete: ["☒", "complete"],
	fatal: ["✖", "fatal"],
	debug: ["⬤", "debug"],
};

const createLogger = (scope) =>
	Object.fromEntries(
		Object.entries(TYPES).map(([type, [badge, label]]) => [
			type,
			(...args) => console.log(`[${scope}] › ${badge}  ${label.padEnd(9)}`, ...args),
		]),
	);

const global = createLogger("Global        ");
const migrate = createLogger("Migrate       ");
const express = createLogger("Express       ");
const access = createLogger("Access        ");
const nginx = createLogger("Nginx         ");
const ssl = createLogger("TLS           ");
const certbot = createLogger("Certbot       ");
const importer = createLogger("Importer      ");
const setup = createLogger("Setup         ");
const ipRanges = createLogger("IP Ranges     ");
const remoteVersion = createLogger("Remote Version");
const gravatar = createLogger("Gravatar      ");
const oidc = createLogger("OIDC          ");

const debug = (logger, ...args) => {
	if (logger !== express) logger.debug(...args);
};

export {
	debug,
	global,
	migrate,
	express,
	access,
	nginx,
	ssl,
	certbot,
	importer,
	setup,
	ipRanges,
	remoteVersion,
	gravatar,
	oidc,
};
