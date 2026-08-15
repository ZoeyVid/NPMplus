import { useQuery } from "@tanstack/react-query";
import { getProxyHosts, type ProxyHost, type ProxyHostExpansion } from "src/api/backend";

const fetchProxyHosts = (expand?: ProxyHostExpansion[]) => getProxyHosts(expand);

const useProxyHosts = (expand?: ProxyHostExpansion[], options = {}) =>
	useQuery<ProxyHost[], Error>({
		queryKey: ["proxy-hosts", { expand }],
		queryFn: () => fetchProxyHosts(expand),
		staleTime: 60 * 1000,
		...options,
	});

export { useProxyHosts };
