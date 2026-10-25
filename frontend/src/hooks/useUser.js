import { useMutation, useQuery } from "@tanstack/react-query";
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

const useUser = (id) => {
	return useQuery({
		queryKey: ["user", id],
		queryFn: () => fetchUser(id),
		staleTime: 60 * 1000, // 1 minute
	});
};

const useSetUser = () =>
	useMutation({
		mutationFn: (values) => (values.id ? updateUser(values) : createUser(values)),
	});

export { useSetUser, useUser };
