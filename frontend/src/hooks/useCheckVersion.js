import { useQuery } from "@tanstack/react-query";
import { checkVersion } from "src/api/backend";

const fetchVersion = () => checkVersion();

const useCheckVersion = () => {
	return useQuery({
		queryKey: ["version-check"],
		queryFn: fetchVersion,
		refetchOnWindowFocus: false,
		retry: 5,
		refetchInterval: 30 * 1000, // 30 seconds
		staleTime: 5 * 60 * 1000, // 5 mins
	});
};

export { useCheckVersion };
