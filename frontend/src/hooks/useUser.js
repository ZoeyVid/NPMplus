import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createUser, getUser, updateUser } from "src/api/backend";

const fetchUser = (id) => {
	if (id === "new") {
		return Promise.resolve({
			id: 0,
			createdOn: "",
			modifiedOn: "",
			isDisabled: false,
			email: "",
			name: "",
			roles: [],
			avatar: "",
		});
	}
	return getUser(id, ["permissions"]);
};

const useUser = (id, options = {}) => {
	return useQuery({
		queryKey: ["user", id],
		queryFn: () => fetchUser(id),
		staleTime: 60 * 1000, // 1 minute
		...options,
	});
};

const useSetUser = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (values) => (values.id ? updateUser(values) : createUser(values)),
		onMutate: (values) => {
			if (!values.id) {
				return;
			}
			const previousObject = queryClient.getQueryData(["user", values.id]);
			queryClient.setQueryData(["user", values.id], (old) => ({
				...old,
				...values,
			}));
			return () => queryClient.setQueryData(["user", values.id], previousObject);
		},
		onError: (_, __, rollback) => rollback(),
		onSuccess: async ({ id }) => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: ["user", id] }),
				queryClient.invalidateQueries({ queryKey: ["users"] }),
				queryClient.invalidateQueries({ queryKey: ["audit-logs"] }),
			]);
		},
	});
};

export { useSetUser, useUser };
