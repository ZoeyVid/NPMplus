import { useQuery } from "@tanstack/react-query";
import { checkVersion } from "src/api/backend";

const fetchVersion = () => checkVersion();

const useCheckVersion = () => {
	return useQuery({
		queryKey: ["version-check"],
		queryFn: fetchVersion,
		retry: 5,
		refetchInterval: 10 * 60 * 1000, // 10 mins
		staleTime: 10 * 60 * 1000, // 10 mins
	});
};

export { useCheckVersion };
