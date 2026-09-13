import { useQuery } from "@tanstack/react-query";
import { getRedirectionHosts } from "src/api/backend";

const fetchRedirectionHosts = (expand) => getRedirectionHosts(expand);

const useRedirectionHosts = (expand, options = {}) =>
	useQuery({
		queryKey: ["redirection-hosts", { expand }],
		queryFn: () => fetchRedirectionHosts(expand),
		staleTime: 60 * 1000,
		...options,
	});

export { useRedirectionHosts };
