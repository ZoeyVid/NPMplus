import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getAuditLogs } from "src/api/backend";

const fetchAuditLogs = (expand, page, pageSize, query) => getAuditLogs(expand, { page, page_size: pageSize, query });

const useAuditLogs = (expand, page, pageSize, query) =>
	useQuery({
		queryKey: ["audit-logs", { expand, page, pageSize, query }],
		queryFn: () => fetchAuditLogs(expand, page, pageSize, query),
		placeholderData: keepPreviousData,
		staleTime: 10 * 1000,
	});

export { useAuditLogs };
