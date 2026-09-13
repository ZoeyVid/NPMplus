import { useQuery } from "@tanstack/react-query";
import { getCertificates } from "src/api/backend";

const fetchCertificates = (expand) => getCertificates(expand);

const useCertificates = (expand, options = {}) =>
	useQuery({
		queryKey: ["certificates", { expand }],
		queryFn: () => fetchCertificates(expand),
		staleTime: 60 * 1000,
		...options,
	});

export { useCertificates };
