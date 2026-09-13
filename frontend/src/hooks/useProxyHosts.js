import { useQuery } from "@tanstack/react-query";
import { getProxyHosts } from "src/api/backend";

const fetchProxyHosts = (expand) => getProxyHosts(expand);

const useProxyHosts = (expand, options = {}) =>
	useQuery({
		queryKey: ["proxy-hosts", { expand }],
		queryFn: () => fetchProxyHosts(expand),
		staleTime: 60 * 1000,
		...options,
	});

export { useProxyHosts };
