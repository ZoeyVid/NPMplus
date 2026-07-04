import { useMemo } from "react";

function getDirectory(item: { meta?: { directory?: unknown } }): string {
	const dir = item?.meta?.directory;
	return typeof dir === "string" ? dir.trim() : "";
}

const useDirectorySuggestions = (items: { meta?: { directory?: unknown } }[] | undefined): string[] => {
	return useMemo(() => {
		return Array.from(new Set((items ?? []).map(getDirectory).filter(Boolean))).sort((a, b) => a.localeCompare(b));
	}, [items]);
};

export { useDirectorySuggestions };
