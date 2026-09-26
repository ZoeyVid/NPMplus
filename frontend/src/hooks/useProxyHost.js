import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createProxyHost, getProxyHost, updateProxyHost } from "src/api/backend";

const fetchProxyHost = (id) => {
	if (id === "new") {
		return Promise.resolve({
			id: 0,
			createdOn: "",
			modifiedOn: "",
			ownerUserId: 0,
			domainNames: [],
			forwardHost: "",
			forwardPort: 0,
			npmplusAccessListIds: [],
			certificateId: 0,
			sslForced: false,
			advancedConfig: "",
			npmplusLocationConfig: "",
			meta: {},
			npmplusHttp3Support: false,
			forwardScheme: "",
			enabled: true,
			hstsEnabled: false,
			hstsSubdomains: false,
			npmplusNoindex: false,
			npmplusCrowdsecAppsec: false,
			npmplusProxyResponseBuffering: false,
			npmplusProxyRequestBuffering: false,
			npmplusUpstreamCompression: false,
			npmplusFancyindex: false,
			npmplusXFrameOptions: "SAMEORIGIN",
			npmplusAuthRequest: "none",
			npmplusAuthRequestUpstream: "",
			npmplusAccessListType: "public",
		});
	}
	return getProxyHost(id);
};

const useProxyHost = (id, options = {}) => {
	return useQuery({
		queryKey: ["proxy-host", id],
		queryFn: () => fetchProxyHost(id),
		staleTime: 60 * 1000, // 1 minute
		...options,
	});
};

const useSetProxyHost = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (values) => (values.id ? updateProxyHost(values) : createProxyHost(values)),
		onMutate: (values) => {
			if (!values.id) {
				return;
			}
			const previousObject = queryClient.getQueryData(["proxy-host", values.id]);
			queryClient.setQueryData(["proxy-host", values.id], (old) => ({
				...old,
				...values,
			}));
			return () => queryClient.setQueryData(["proxy-host", values.id], previousObject);
		},
		onError: (_, __, rollback) => rollback(),
		onSuccess: async ({ id }) => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: ["proxy-host", id] }),
				queryClient.invalidateQueries({ queryKey: ["proxy-hosts"] }),
				queryClient.invalidateQueries({ queryKey: ["audit-logs"] }),
				queryClient.invalidateQueries({ queryKey: ["host-report"] }),
				queryClient.invalidateQueries({ queryKey: ["certificates"] }),
				queryClient.invalidateQueries({ queryKey: ["access-lists"] }),
			]);
		},
	});
};

export { useProxyHost, useSetProxyHost };
