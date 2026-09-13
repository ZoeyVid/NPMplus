import { useQuery } from "@tanstack/react-query";
import { getAuditLogs } from "src/api/backend";

const fetchAuditLogs = (expand) => getAuditLogs(expand);

const useAuditLogs = (expand, options = {}) =>
	useQuery({
		queryKey: ["audit-logs", { expand }],
		queryFn: () => fetchAuditLogs(expand),
		staleTime: 10 * 1000,
		...options,
	});

export { useAuditLogs };
