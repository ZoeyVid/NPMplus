import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createRedirectionHost, getRedirectionHost, updateRedirectionHost } from "src/api/backend";

const fetchRedirectionHost = (id) => {
	if (id === "new") {
		return Promise.resolve({
			id: 0,
			createdOn: "",
			modifiedOn: "",
			ownerUserId: 0,
			domainNames: [],
			forwardDomainName: "",
			preservePath: false,
			certificateId: 0,
			sslForced: false,
			advancedConfig: "",
			npmplusDirectory: "",
			npmplusMtlsCertificateId: 0,
			npmplusMtlsVerifyClientOptional: false,
			npmplusHttp3Support: false,
			forwardScheme: "$scheme",
			forwardHttpCode: 301,
			enabled: true,
			hstsEnabled: false,
			hstsSubdomains: false,
		});
	}
	return getRedirectionHost(id);
};

const useRedirectionHost = (id) => {
	return useQuery({
		queryKey: ["redirection-host", id],
		queryFn: () => fetchRedirectionHost(id),
		staleTime: 60 * 1000, // 1 minute
	});
};

const useSetRedirectionHost = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (values) => (values.id ? updateRedirectionHost(values) : createRedirectionHost(values)),
		onSuccess: async ({ id }) => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: ["redirection-host", id] }),
				queryClient.invalidateQueries({ queryKey: ["redirection-hosts"] }),
				queryClient.invalidateQueries({ queryKey: ["audit-logs"] }),
				queryClient.invalidateQueries({ queryKey: ["host-report"] }),
				queryClient.invalidateQueries({ queryKey: ["certificates"] }),
			]);
		},
	});
};

export { useRedirectionHost, useSetRedirectionHost };
