import { IconWorld } from "@tabler/icons-react";
import cn from "clsx";

function Flag({ className, countryCode, title }) {
	if (countryCode === "en") {
		return <IconWorld className={className} width={20} title={title} />;
	}

	return <span title={title} className={cn("flag flag-xs", `flag-country-${countryCode}`, className)} />;
}

export { Flag };
