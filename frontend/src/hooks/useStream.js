import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createStream, getStream, updateStream } from "src/api/backend";

const fetchStream = (id) => {
	if (id === "new") {
		return Promise.resolve({
			id: 0,
			createdOn: "",
			modifiedOn: "",
			ownerUserId: 0,
			incomingPort: "",
			forwardingHost: "",
			forwardingPort: "",
			tcpForwarding: true,
			udpForwarding: false,
			npmplusProxyProtocolForwarding: 0,
			npmplusProxyTls: false,
			npmplusAdvancedConfig: "",
			npmplusDirectory: "",
			npmplusMtlsCertificateId: 0,
			npmplusMtlsVerifyClientOptional: false,
			enabled: true,
			certificateId: 0,
			npmplusDescription: "",
		});
	}
	return getStream(id);
};

const useStream = (id) => {
	return useQuery({
		queryKey: ["stream", id],
		queryFn: () => fetchStream(id),
		staleTime: 60 * 1000, // 1 minute
	});
};

const useSetStream = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (values) => (values.id ? updateStream(values) : createStream(values)),
		onSuccess: async ({ id }) => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: ["stream", id] }),
				queryClient.invalidateQueries({ queryKey: ["streams"] }),
				queryClient.invalidateQueries({ queryKey: ["audit-logs"] }),
				queryClient.invalidateQueries({ queryKey: ["host-report"] }),
				queryClient.invalidateQueries({ queryKey: ["certificates"] }),
			]);
		},
	});
};

export { useSetStream, useStream };
