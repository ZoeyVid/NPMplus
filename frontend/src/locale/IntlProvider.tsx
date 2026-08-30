import { createIntl, createIntlCache } from "react-intl";
import langList from "translations/lang-list.json" with { type: "json" };

const uiFiles = import.meta.glob<Record<string, string>>("../../translations/ui/*.json", {
	eager: true,
	import: "default",
});

const messagesFor = (lang: string) => uiFiles[`../../translations/ui/${lang}.json`];

const localeList: Record<string, { flag: string; name: string }> = langList;

const localeOptions = ["en", ...Object.keys(localeList).filter((locale) => locale !== "en")];

const getFlagCodeForLocale = (locale = "en") => localeList[locale]?.flag ?? "EN";

const loadMessages = (locale = "en") => ({ ...messagesFor("en"), ...messagesFor(locale) });

const getLocale = () => {
	let loc = window.localStorage.getItem("locale");
	if (!loc) loc = document.documentElement.lang;
	// finally, fallback
	if (!loc) loc = "en";
	return loc;
};

const cache = createIntlCache();

const initialMessages = loadMessages(getLocale());
let intl = createIntl({ locale: getLocale(), messages: initialMessages }, cache);

const changeLocale = (locale: string): void => {
	const messages = loadMessages(locale);
	intl = createIntl({ locale, messages }, cache);
	window.localStorage.setItem("locale", locale);
	document.documentElement.lang = locale;
};

// This is a translation component that wraps the translation in a span with a data
// attribute so devs can inspect the element to see the translation ID
const T = ({
	id,
	data,
	tData,
}: {
	id: string;
	data?: Record<string, string | number | undefined>;
	tData?: Record<string, string>;
}) => {
	const translatedData: Record<string, string> = {};
	if (tData) {
		// iterate over tData and translate each value
		for (const [key, value] of Object.entries(tData)) {
			translatedData[key] = intl.formatMessage({ id: value });
		}
	}
	return (
		<span data-translation-id={id}>
			{intl.formatMessage(
				{ id },
				{
					...data,
					...translatedData,
				},
			)}
		</span>
	);
};

export { changeLocale, getFlagCodeForLocale, getLocale, intl, localeList, localeOptions, T };
