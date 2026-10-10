import { useQuery } from "@tanstack/react-query";
import { getAccessLists } from "src/api/backend";

const fetchAccessLists = (expand) => getAccessLists(expand);

const useAccessLists = (expand) =>
	useQuery({
		queryKey: ["access-lists", { expand }],
		queryFn: () => fetchAccessLists(expand),
		staleTime: 60 * 1000,
	});

export { useAccessLists };
