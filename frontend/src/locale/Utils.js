import { currentLocale } from "./IntlProvider.jsx";

const formatDateTime = (value) =>
	new Intl.DateTimeFormat(currentLocale, {
		dateStyle: "medium",
		timeStyle: "medium",
		hourCycle: new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).resolvedOptions().hourCycle,
	}).format(new Date(value));

export { formatDateTime };
