import { useQuery } from "@tanstack/react-query";
import { getAuditLog } from "src/api/backend";

const fetchAuditLog = (id) => getAuditLog(id, ["user"]);

const useAuditLog = (id) => {
	return useQuery({
		queryKey: ["audit-log", id],
		queryFn: () => fetchAuditLog(id),
		staleTime: 5 * 60 * 1000, // 5 minutes
	});
};

export { useAuditLog };
