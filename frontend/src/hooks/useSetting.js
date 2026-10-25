import { useMutation, useQuery } from "@tanstack/react-query";
import { getSetting, updateSetting } from "src/api/backend";

const fetchSetting = (id) => getSetting(id);

const useSetting = (id) => {
	return useQuery({
		queryKey: ["setting", id],
		queryFn: () => fetchSetting(id),
		staleTime: 60 * 1000, // 1 minute
	});
};

const useSetSetting = () =>
	useMutation({
		mutationFn: (values) => updateSetting(values),
	});

export { useSetSetting, useSetting };
