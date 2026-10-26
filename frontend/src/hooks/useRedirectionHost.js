import { useMutation, useQuery } from "@tanstack/react-query";
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

const useSetRedirectionHost = () =>
	useMutation({
		mutationFn: (values) => (values.id ? updateRedirectionHost(values) : createRedirectionHost(values)),
	});

export { useRedirectionHost, useSetRedirectionHost };
