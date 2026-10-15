const forwardSummary = ({ forwardScheme, forwardHost, forwardPort }) => {
	if (!forwardHost || forwardScheme === "empty") return "";
	if (forwardScheme !== "path") {
		return `${forwardScheme}://${forwardHost}${forwardPort ? `:${forwardPort}` : ""}`;
	}
	return forwardHost;
};

// used to notify user that custom upstreams/manually configured upstreams are being used,
// so any UI changes aren't being used
const isCustomUpstream = (upstreamServers = []) =>
	typeof upstreamServers[0]?.host === "string" &&
	upstreamServers[0].host.startsWith("cu_");

export { forwardSummary, isCustomUpstream };
