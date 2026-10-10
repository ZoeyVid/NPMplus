import { useQuery } from "@tanstack/react-query";
import { getProxyHosts } from "src/api/backend";

const fetchProxyHosts = (expand) => getProxyHosts(expand);

const useProxyHosts = (expand) =>
	useQuery({
		queryKey: ["proxy-hosts", { expand }],
		queryFn: () => fetchProxyHosts(expand),
		staleTime: 60 * 1000,
	});

export { useProxyHosts };
