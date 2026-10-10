import { useQuery } from "@tanstack/react-query";
import { getCertificate } from "src/api/backend";

const fetchCertificate = (id) => getCertificate(id);

const useCertificate = (id) => {
	return useQuery({
		queryKey: ["certificate", id],
		queryFn: () => fetchCertificate(id),
		staleTime: 60 * 1000, // 1 minute
	});
};

export { useCertificate };
