import { useQuery } from "@tanstack/react-query";
import { type DeadHost, getDeadHosts, type HostExpansion } from "src/api/backend";

const fetchDeadHosts = (expand?: HostExpansion[]) => getDeadHosts(expand);

const useDeadHosts = (expand?: HostExpansion[], options = {}) =>
	useQuery<DeadHost[], Error>({
		queryKey: ["dead-hosts", { expand }],
		queryFn: () => fetchDeadHosts(expand),
		staleTime: 60 * 1000,
		...options,
	});

export { useDeadHosts };
