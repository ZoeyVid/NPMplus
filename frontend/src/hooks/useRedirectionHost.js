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
			meta: {},
			http2Support: true,
			npmplusHttp3Support: false,
			forwardScheme: "auto",
			forwardHttpCode: 301,
			blockExploits: false,
			enabled: true,
			hstsEnabled: false,
			hstsSubdomains: false,
		});
	}
	return getRedirectionHost(id, ["owner"]);
};

const useRedirectionHost = (id, options = {}) => {
	return useQuery({
		queryKey: ["redirection-host", id],
		queryFn: () => fetchRedirectionHost(id),
		staleTime: 60 * 1000, // 1 minute
		...options,
	});
};

const useSetRedirectionHost = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (values) => (values.id ? updateRedirectionHost(values) : createRedirectionHost(values)),
		onMutate: (values) => {
			if (!values.id) {
				return;
			}
			const previousObject = queryClient.getQueryData(["redirection-host", values.id]);
			queryClient.setQueryData(["redirection-host", values.id], (old) => ({
				...old,
				...values,
			}));
			return () => queryClient.setQueryData(["redirection-host", values.id], previousObject);
		},
		onError: (_, __, rollback) => rollback(),
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
