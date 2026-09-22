import { createIntl } from "react-intl";
import localeList from "translations/lang-list.json" with { type: "json" };

const uiFiles = import.meta.glob("../../translations/ui/*.json", {
	eager: true,
	import: "default",
});

const localeOptions = ["en", ...Object.keys(localeList).filter((locale) => locale !== "en")];

const storedLocale = window.localStorage.getItem("locale");
const currentLocale = localeOptions.includes(storedLocale) ? storedLocale : "en";

document.documentElement.lang = currentLocale;
if (localeList[currentLocale].rtl) document.dir = "rtl";

const intl = createIntl({
	locale: currentLocale,
	messages: {
		...uiFiles["../../translations/ui/en.json"],
		...uiFiles[`../../translations/ui/${currentLocale}.json`],
	},
});

const getFlagCodeForLocale = (locale = currentLocale) => localeList[locale].flag;

const changeLocale = (lang) => {
	window.localStorage.setItem("locale", lang);
	location.reload();
};

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

export { changeLocale, currentLocale, getFlagCodeForLocale, intl, localeOptions, T };
