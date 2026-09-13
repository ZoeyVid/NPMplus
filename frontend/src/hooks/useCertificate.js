import { useQuery } from "@tanstack/react-query";
import { getCertificate } from "src/api/backend";

const fetchCertificate = (id) => getCertificate(id, ["owner"]);

const useCertificate = (id, options = {}) => {
	return useQuery({
		queryKey: ["certificate", id],
		queryFn: () => fetchCertificate(id),
		staleTime: 60 * 1000, // 1 minute
		...options,
	});
};

export { useCertificate };
