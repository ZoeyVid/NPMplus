import { useQuery } from "@tanstack/react-query";
import { getAccessLists } from "src/api/backend";

const fetchAccessLists = (expand) => getAccessLists(expand);

const useAccessLists = (expand, options = {}) =>
	useQuery({
		queryKey: ["access-lists", { expand }],
		queryFn: () => fetchAccessLists(expand),
		staleTime: 60 * 1000,
		...options,
	});

export { useAccessLists };
