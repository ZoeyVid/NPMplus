const forwardSummary = ({ forwardScheme, forwardHost, forwardPort }) => {
	if (!forwardHost || forwardScheme === "empty") return "";
	if (forwardScheme !== "path") {
		const [host, ...path] = forwardHost.split("/");
		return [`${forwardScheme}://${host}${forwardPort ? `:${forwardPort}` : ""}`, ...path].join("/");
	}
	return forwardHost;
};

// used to notify user that custom upstreams/manually configured upstreams are being used,
// so any UI changes aren't being used
const isCustomUpstream = (upstreamServers = []) =>
	typeof upstreamServers[0]?.host === "string" &&
	upstreamServers[0].host.startsWith("cu_");

export { forwardSummary, isCustomUpstream };
