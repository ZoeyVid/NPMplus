import { useQuery } from "@tanstack/react-query";
import { type DNSProvider, getCertificateDNSProviders } from "src/api/backend";

const fetchDnsProviders = () => getCertificateDNSProviders();

const useDnsProviders = (options = {}) =>
	useQuery<DNSProvider[], Error>({
		queryKey: ["dns-providers"],
		queryFn: () => fetchDnsProviders(),
		staleTime: 300 * 1000,
		...options,
	});

export { useDnsProviders };
