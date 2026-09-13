import { IconWorld } from "@tabler/icons-react";
import { hasFlag } from "country-flag-icons";
// @ts-expect-error Creating a typing for a subfolder is not easily possible
import Flags from "country-flag-icons/react/3x2";

function Flag({ className, countryCode }) {
	countryCode = countryCode.toUpperCase();
	if (countryCode === "EN") {
		return <IconWorld className={className} width={20} />;
	}

	if (hasFlag(countryCode)) {
		const FlagElement = Flags[countryCode];
		return <FlagElement title={countryCode} className={className} width={20} />;
	}
	console.error(`No flag for country ${countryCode} found!`);
	return null;
}

export { Flag };
