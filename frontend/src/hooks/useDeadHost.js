import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createDeadHost, getDeadHost, updateDeadHost } from "src/api/backend";

const fetchDeadHost = (id) => {
	if (id === "new") {
		return Promise.resolve({
			id: 0,
			createdOn: "",
			modifiedOn: "",
			ownerUserId: 0,
			domainNames: [],
			certificateId: 0,
			sslForced: false,
			advancedConfig: "",
			npmplusDirectory: "",
			npmplusMtlsCertificateId: 0,
			npmplusMtlsVerifyClientOptional: false,
			npmplusHttp3Support: false,
			enabled: true,
			hstsEnabled: false,
			hstsSubdomains: false,
		});
	}
	return getDeadHost(id);
};

const useDeadHost = (id) => {
	return useQuery({
		queryKey: ["dead-host", id],
		queryFn: () => fetchDeadHost(id),
		staleTime: 60 * 1000, // 1 minute
	});
};

const useSetDeadHost = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (values) => (values.id ? updateDeadHost(values) : createDeadHost(values)),
		onSuccess: async ({ id }) => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: ["dead-host", id] }),
				queryClient.invalidateQueries({ queryKey: ["dead-hosts"] }),
				queryClient.invalidateQueries({ queryKey: ["audit-logs"] }),
				queryClient.invalidateQueries({ queryKey: ["host-report"] }),
				queryClient.invalidateQueries({ queryKey: ["certificates"] }),
			]);
		},
	});
};

export { useDeadHost, useSetDeadHost };
