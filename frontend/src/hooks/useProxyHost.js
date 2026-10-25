import { useMutation, useQuery } from "@tanstack/react-query";
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
			accessLists: [],
			locations: [],
			certificateId: 0,
			sslForced: false,
			advancedConfig: "",
			npmplusLocationConfig: "",
			npmplusDirectory: "",
			npmplusMtlsCertificateId: 0,
			npmplusMtlsVerifyClientOptional: false,
			npmplusMtlsBypassAuthRequest: false,
			npmplusHttp3Support: false,
			forwardScheme: "http",
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

const useProxyHost = (id) => {
	return useQuery({
		queryKey: ["proxy-host", id],
		queryFn: () => fetchProxyHost(id),
		staleTime: 60 * 1000, // 1 minute
	});
};

const useSetProxyHost = () =>
	useMutation({
		mutationFn: (values) => (values.id ? updateProxyHost(values) : createProxyHost(values)),
	});

export { useProxyHost, useSetProxyHost };
