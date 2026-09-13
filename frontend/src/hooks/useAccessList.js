import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createAccessList, getAccessList, updateAccessList } from "src/api/backend";

const fetchAccessList = (id, expand = ["owner"]) => {
	if (id === "new") {
		return Promise.resolve({
			id: 0,
			createdOn: "",
			modifiedOn: "",
			ownerUserId: 0,
			name: "",
			satisfyAny: false,
			passAuth: false,
			meta: {},
		});
	}
	return getAccessList(id, expand);
};

const useAccessList = (id, expand, options = {}) => {
	return useQuery({
		queryKey: ["access-list", id, expand],
		queryFn: () => fetchAccessList(id, expand),
		staleTime: 60 * 1000, // 1 minute
		...options,
	});
};

const useSetAccessList = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (values) => (values.id ? updateAccessList(values) : createAccessList(values)),
		onMutate: (values) => {
			if (!values.id) {
				return;
			}
			const previousObject = queryClient.getQueryData(["access-list", values.id]);
			queryClient.setQueryData(["access-list", values.id], (old) => ({
				...old,
				...values,
			}));
			return () => queryClient.setQueryData(["access-list", values.id], previousObject);
		},
		onError: (_, __, rollback) => rollback(),
		onSuccess: async ({ id }) => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: ["access-list", id] }),
				queryClient.invalidateQueries({ queryKey: ["access-lists"] }),
				queryClient.invalidateQueries({ queryKey: ["audit-logs"] }),
				queryClient.invalidateQueries({ queryKey: ["proxy-hosts"] }),
			]);
		},
	});
};

export { useAccessList, useSetAccessList };
