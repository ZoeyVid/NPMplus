import { useQuery } from "@tanstack/react-query";
import { type Certificate, type CertificateExpansion, getCertificates } from "src/api/backend";

const fetchCertificates = (expand?: CertificateExpansion[]) => getCertificates(expand);

const useCertificates = (expand?: CertificateExpansion[], options = {}) =>
	useQuery<Certificate[], Error>({
		queryKey: ["certificates", { expand }],
		queryFn: () => fetchCertificates(expand),
		staleTime: 60 * 1000,
		...options,
	});

export { useCertificates };
