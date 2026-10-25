import { useMutation, useQuery } from "@tanstack/react-query";
import { createAccessList, getAccessList, updateAccessList } from "src/api/backend";

const fetchAccessList = (id) => {
	if (id === "new") {
		return Promise.resolve({
			id: 0,
			createdOn: "",
			modifiedOn: "",
			ownerUserId: 0,
			name: "",
			satisfyAny: false,
			passAuth: false,
			items: [],
			clients: [],
		});
	}
	return getAccessList(id, ["items", "clients"]);
};

const useAccessList = (id) => {
	return useQuery({
		queryKey: ["access-list", id],
		queryFn: () => fetchAccessList(id),
		staleTime: 60 * 1000, // 1 minute
	});
};

const useSetAccessList = () =>
	useMutation({
		mutationFn: (values) => (values.id ? updateAccessList(values) : createAccessList(values)),
	});

export { useAccessList, useSetAccessList };
