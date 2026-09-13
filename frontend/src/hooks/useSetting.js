import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSetting, updateSetting } from "src/api/backend";

const fetchSetting = (id) => getSetting(id);

const useSetting = (id, options = {}) => {
	return useQuery({
		queryKey: ["setting", id],
		queryFn: () => fetchSetting(id),
		staleTime: 60 * 1000, // 1 minute
		...options,
	});
};

const useSetSetting = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (values) => updateSetting(values),
		onMutate: (values) => {
			if (!values.id) {
				return;
			}
			const previousObject = queryClient.getQueryData(["setting", values.id]);
			queryClient.setQueryData(["setting", values.id], (old) => ({
				...old,
				...values,
			}));
			return () => queryClient.setQueryData(["setting", values.id], previousObject);
		},
		onError: (_, __, rollback) => rollback(),
		onSuccess: async ({ id }) => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: ["setting", id] }),
				queryClient.invalidateQueries({ queryKey: ["audit-logs"] }),
			]);
		},
	});
};

export { useSetSetting, useSetting };
