const forwardSummary = ({ forwardScheme, forwardHost, forwardPort }) => {
	if (!forwardHost || forwardScheme === "empty") return "";
	if (forwardScheme !== "path") {
		return `${forwardScheme}://${forwardHost}${forwardPort ? `:${forwardPort}` : ""}`;
	}
	return forwardHost;
};

export { forwardSummary };
