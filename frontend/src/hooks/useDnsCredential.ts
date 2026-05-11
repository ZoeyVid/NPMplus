import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createDnsCredential, type DnsCredential, getDnsCredential, updateDnsCredential } from "src/api/backend";

const fetchDnsCredential = (id: number) => {
	if (id === -1) {
		return Promise.resolve({
			id: 0,
			name: "",
			providerId: "",
			credentials: "",
		} as DnsCredential);
	}
	return getDnsCredential(id);
};

const useDnsCredential = (id: number, options = {}) => {
	return useQuery<DnsCredential, Error>({
		queryKey: ["dns-credential", id],
		queryFn: () => fetchDnsCredential(id),
		staleTime: 60 * 1000, // 1 minute
		enabled: id !== -1,
		...options,
	});
};

const useSetDnsCredential = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (values: DnsCredential) => {
			if ("id" in values && values.id) {
				const { id, ...item } = values;
				return updateDnsCredential(id, item);
			}
			return createDnsCredential(values);
		},
		onMutate: (values: DnsCredential) => {
			if (!values.id) {
				return;
			}
			const previousObject = queryClient.getQueryData(["dns-credential", values.id]);
			queryClient.setQueryData(["dns-credential", values.id], (old: DnsCredential) => ({
				...old,
				...values,
			}));
			return () => queryClient.setQueryData(["dns-credential", values.id], previousObject);
		},
		onError: (_, __, rollback: any) => rollback(),
		onSuccess: async ({ id }: DnsCredential) => {
			queryClient.invalidateQueries({ queryKey: ["dns-credential", id] });
			queryClient.invalidateQueries({ queryKey: ["dns-credentials"] });
		},
	});
};

export { useDnsCredential, useSetDnsCredential };
