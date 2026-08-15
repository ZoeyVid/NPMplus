const createLogger = (scope) =>
	Object.fromEntries(
		["info", "warn", "error", "success", "start", "complete", "fatal", "debug"].map((type) => [
			type,
			(...args) => console.log(`[${scope}] › ${type.padEnd(9)}`, ...args),
		]),
	);

const global = createLogger("Global        ");
const migrate = createLogger("Migrate       ");
const express = createLogger("Express       ");
const access = createLogger("Access        ");
const nginx = createLogger("Nginx         ");
const ssl = createLogger("TLS           ");
const certbot = createLogger("Certbot       ");
const setup = createLogger("Setup         ");
const ipRanges = createLogger("IP Ranges     ");
const remoteVersion = createLogger("Remote Version");
const gravatar = createLogger("Gravatar      ");
const oidc = createLogger("OIDC          ");

const debug = (logger, ...args) => {
	if (logger !== express) logger.debug(...args);
};

export { access, certbot, debug, express, global, gravatar, ipRanges, migrate, nginx, oidc, remoteVersion, setup, ssl };
