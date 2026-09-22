import { createIntl, createIntlCache } from "react-intl";
import langList from "translations/lang-list.json" with { type: "json" };

const uiFiles = import.meta.glob("../../translations/ui/*.json", {
	eager: true,
	import: "default",
});

const messagesFor = (lang) => uiFiles[`../../translations/ui/${lang}.json`];

const localeList = langList;

const localeOptions = ["en", ...Object.keys(localeList).filter((locale) => locale !== "en")];

const getFlagCodeForLocale = (locale = "en") => localeList[locale]?.flag ?? "EN";

const loadMessages = (locale = "en") => ({
	...messagesFor("en"),
	...messagesFor(locale),
});

const getLocale = () => {
	let loc = window.localStorage.getItem("locale");
	if (!loc) loc = document.documentElement.lang;
	// finally, fallback
	if (!localeOptions.includes(loc)) loc = "en";
	return loc;
};

const changeLocale = (lang) => {
	window.localStorage.setItem("locale", lang);
	location.reload();
};

const cache = createIntlCache();

const currentLocale = getLocale();
const initialMessages = loadMessages(currentLocale);
document.documentElement.lang = currentLocale;
if (localeList[currentLocale]?.rtl) document.dir = "rtl";
const intl = createIntl({ locale: currentLocale, messages: initialMessages }, cache);

// This is a translation component that wraps the translation in a span with a data
// attribute so devs can inspect the element to see the translation ID
const T = ({ id, data, tData }) => {
	const translatedData = {};
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

export { changeLocale, currentLocale, getFlagCodeForLocale, intl, localeList, localeOptions, T };
