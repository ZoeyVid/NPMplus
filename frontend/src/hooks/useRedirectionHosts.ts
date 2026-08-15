import { useQuery } from "@tanstack/react-query";
import { getRedirectionHosts, type HostExpansion, type RedirectionHost } from "src/api/backend";

const fetchRedirectionHosts = (expand?: HostExpansion[]) => getRedirectionHosts(expand);

const useRedirectionHosts = (expand?: HostExpansion[], options = {}) =>
	useQuery<RedirectionHost[], Error>({
		queryKey: ["redirection-hosts", { expand }],
		queryFn: () => fetchRedirectionHosts(expand),
		staleTime: 60 * 1000,
		...options,
	});

export { useRedirectionHosts };
