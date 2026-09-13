import { useQuery } from "@tanstack/react-query";
import { getStreams } from "src/api/backend";

const fetchStreams = (expand) => getStreams(expand);

const useStreams = (expand, options = {}) =>
	useQuery({
		queryKey: ["streams", { expand }],
		queryFn: () => fetchStreams(expand),
		staleTime: 60 * 1000,
		...options,
	});

export { useStreams };
