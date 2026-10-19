const forwardSummary = ({ forwardScheme, forwardHost, forwardPort }) => {
	if (!forwardHost || forwardScheme === "empty") return "";
	if (forwardScheme !== "path") {
		const [host, ...path] = forwardHost.split("/");
		return [`${forwardScheme}://${host}${forwardPort ? `:${forwardPort}` : ""}`, ...path].join("/");
	}
	return forwardHost;
};

export { forwardSummary };
