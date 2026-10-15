const NETWORK_FORWARD_SCHEMES = ["http", "https", "grpc", "grpcs"];
const FORWARD_PATH_SCHEMES = ["http", "https"];

const populatedUpstreams = ({ npmplusUpstreamServers = [] }) => npmplusUpstreamServers.filter((server) => server?.host);

const forwardDestination = ({ forwardScheme, npmplusForwardPath },server,{ streams = false } = {}) => {
	if (!server?.host) {
		return "";
	}

	const port = server.port === null ||
		server.port === undefined ||
		server.port === ""
			? "" : `:${server.port}`;

	if (streams) {
		return `${server.host}${port}`;
	}

	if (NETWORK_FORWARD_SCHEMES.includes(forwardScheme)) {
		const path = FORWARD_PATH_SCHEMES.includes(forwardScheme) ? npmplusForwardPath ?? "" : "";
		return `${forwardScheme}://${server.host}${port}${path}`;
	}

	return server.host;
};

const forwardDestinations = (item, options) =>
	populatedUpstreams(item).map((server) => forwardDestination(item, server, options));

const forwardSummary = (item, { limit = 2, ...options } = {}) =>
	forwardDestinations(item, options).slice(0, limit).join(", ");

const forwardSearchText = (item, options) => forwardDestinations(item, options).join(" ");

// has custom upstreams if its not first
const hasCustomUpstream = (upstreamServers = []) =>
	upstreamServers.some((server) => typeof server?.host === "string" && server.host.startsWith("cu_"));

// a custom upstream is only active if its first
const isCustomUpstream = (upstreamServers = []) =>
	typeof upstreamServers[0]?.host === "string" &&
	upstreamServers[0].host.startsWith("cu_");

export {
	forwardDestination,
	forwardDestinations,
	forwardSearchText,
	forwardSummary,
	hasCustomUpstream,
	isCustomUpstream,
	populatedUpstreams
};
