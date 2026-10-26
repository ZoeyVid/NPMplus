import { IconWorld } from "@tabler/icons-react";
import cn from "clsx";

function Flag({ className, countryCode }) {
	if (countryCode === "en") {
		return <IconWorld className={className} width={20} />;
	}

	return <span title={countryCode} className={cn("flag flag-xs", `flag-country-${countryCode}`, className)} />;
}

export { Flag };
