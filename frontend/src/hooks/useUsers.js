import { useQuery } from "@tanstack/react-query";
import { getUsers } from "src/api/backend";

const fetchUsers = (expand) => getUsers(expand);

const useUsers = (expand, options = {}) =>
	useQuery({
		queryKey: ["users", { expand }],
		queryFn: () => fetchUsers(expand),
		staleTime: 60 * 1000,
		...options,
	});

export { useUsers };
