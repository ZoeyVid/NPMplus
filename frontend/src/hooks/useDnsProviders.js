import { useQuery } from "@tanstack/react-query";
import { getCertificateDNSProviders } from "src/api/backend";

const fetchDnsProviders = () => getCertificateDNSProviders();

const useDnsProviders = () =>
	useQuery({
		queryKey: ["dns-providers"],
		queryFn: () => fetchDnsProviders(),
		staleTime: 300 * 1000,
	});

export { useDnsProviders };
