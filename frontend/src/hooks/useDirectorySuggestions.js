import { useMemo } from "react";

const getDirectory = (item) => {
	const dir = item?.meta?.directory;
	return typeof dir === "string" ? dir.trim() : "";
};

const useDirectorySuggestions = (items) =>
	useMemo(
		() => Array.from(new Set((items ?? []).map(getDirectory).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
		[items],
	);

export { getDirectory, useDirectorySuggestions };
