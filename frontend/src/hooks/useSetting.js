import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSetting, updateSetting } from "src/api/backend";

const fetchSetting = (id) => getSetting(id);

const useSetting = (id) => {
	return useQuery({
		queryKey: ["setting", id],
		queryFn: () => fetchSetting(id),
		staleTime: 60 * 1000, // 1 minute
	});
};

const useSetSetting = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (values) => updateSetting(values),
		onSuccess: async ({ id }) => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: ["setting", id] }),
				queryClient.invalidateQueries({ queryKey: ["audit-logs"] }),
			]);
		},
	});
};

export { useSetSetting, useSetting };
