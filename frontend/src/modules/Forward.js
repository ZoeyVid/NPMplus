const HTTP_FORWARD_SCHEMES = ["http", "https"];
const GRPC_FORWARD_SCHEMES = ["grpc", "grpcs"];
const TLS_FORWARD_SCHEMES = ["https", "grpcs"];
const NETWORK_FORWARD_SCHEMES = [...HTTP_FORWARD_SCHEMES, ...GRPC_FORWARD_SCHEMES];

const isNetworkForwardScheme = (scheme) => NETWORK_FORWARD_SCHEMES.includes(scheme);
const isHttpForwardScheme = (scheme) => HTTP_FORWARD_SCHEMES.includes(scheme);
const isTlsForwardScheme = (scheme) => TLS_FORWARD_SCHEMES.includes(scheme);

const populatedUpstreams = ({ npmplusUpstreamServers = [] }) => npmplusUpstreamServers.filter((server) => server?.host);

const forwardDestination = ({ forwardScheme, npmplusForwardPath }, server, { streams = false } = {}) => {
	if (!server?.host) {
		return "";
	}

	const port = server.port === null || server.port === undefined || server.port === "" ? "" : `:${server.port}`;

	if (streams) {
		return `${server.host}${port}`;
	}

	if (isNetworkForwardScheme(forwardScheme)) {
		const path = isHttpForwardScheme(forwardScheme) ? (npmplusForwardPath ?? "") : "";
		return `${forwardScheme}://${server.host}${port}${path}`;
	}

	return server.host;
};

const forwardDestinations = (item, options) =>
	populatedUpstreams(item).map((server) => forwardDestination(item, server, options));

const forwardSummary = (item, { limit = 2, ...options } = {}) =>
	forwardDestinations(item, options).slice(0, limit).join(", ");

const forwardSearchText = (item, options) => forwardDestinations(item, options).join(" ");

const isCustomUpstreamServer = (server) => server?.custom === true;

// has custom upstreams if its not first
const hasCustomUpstream = (upstreamServers = []) => upstreamServers.some(isCustomUpstreamServer);

// a custom upstream is only active if its first
const isCustomUpstream = (upstreamServers = []) => isCustomUpstreamServer(upstreamServers[0]);

export {
	forwardDestination,
	forwardDestinations,
	forwardSearchText,
	forwardSummary,
	hasCustomUpstream,
	isCustomUpstream,
	isCustomUpstreamServer,
	isHttpForwardScheme,
	isNetworkForwardScheme,
	isTlsForwardScheme,
	populatedUpstreams,
};
