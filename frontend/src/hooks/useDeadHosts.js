import { useQuery } from "@tanstack/react-query";
import { getDeadHosts } from "src/api/backend";

const fetchDeadHosts = (expand) => getDeadHosts(expand);

const useDeadHosts = (expand, options = {}) =>
	useQuery({
		queryKey: ["dead-hosts", { expand }],
		queryFn: () => fetchDeadHosts(expand),
		staleTime: 60 * 1000,
		...options,
	});

export { useDeadHosts };
