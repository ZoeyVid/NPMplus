import { useQuery } from "@tanstack/react-query";
import { type DnsCredential, getDnsCredentials } from "src/api/backend";

const fetchDnsCredentials = () => {
	return getDnsCredentials();
};

const useDnsCredentials = (options = {}) => {
	return useQuery<DnsCredential[], Error>({
		queryKey: ["dns-credentials"],
		queryFn: () => fetchDnsCredentials(),
		...options,
	});
};

export { fetchDnsCredentials, useDnsCredentials };
