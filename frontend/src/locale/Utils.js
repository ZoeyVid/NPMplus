import { intlFormat, parseISO } from "date-fns";
import { currentLocale } from "./IntlProvider.jsx";

const formatDateTime = (value) =>
	intlFormat(
		parseISO(value),
		{
			dateStyle: "medium",
			timeStyle: "medium",
			hourCycle: "h23",
		},
		{ locale: currentLocale },
	);

export { formatDateTime };
