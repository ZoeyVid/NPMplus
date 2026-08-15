import { createIntl, createIntlCache } from "react-intl";
import langBg from "./lang/bg.json" with { type: "json" };
import langCs from "./lang/cs.json" with { type: "json" };
import langDe from "./lang/de.json" with { type: "json" };
import langEn from "./lang/en.json" with { type: "json" };
import langEs from "./lang/es.json" with { type: "json" };
import langEt from "./lang/et.json" with { type: "json" };
import langFr from "./lang/fr.json" with { type: "json" };
import langGa from "./lang/ga.json" with { type: "json" };
import langHu from "./lang/hu.json" with { type: "json" };
import langId from "./lang/id.json" with { type: "json" };
import langIt from "./lang/it.json" with { type: "json" };
import langJa from "./lang/ja.json" with { type: "json" };
import langKo from "./lang/ko.json" with { type: "json" };
import langList from "./lang/lang-list.json" with { type: "json" };
import langNl from "./lang/nl.json" with { type: "json" };
import langNo from "./lang/no.json" with { type: "json" };
import langPl from "./lang/pl.json" with { type: "json" };
import langPt from "./lang/pt.json" with { type: "json" };
import langRu from "./lang/ru.json" with { type: "json" };
import langSk from "./lang/sk.json" with { type: "json" };
import langTr from "./lang/tr.json" with { type: "json" };
import langVi from "./lang/vi.json" with { type: "json" };
import langZh from "./lang/zh.json" with { type: "json" };

// first item of each array should be the language code,
// not the country code
// Remember when adding to this list, also update check-locales.js script
const localeOptions = [
	["en", "en-US", langEn],
	["bg", "bg-BG", langBg],
	["cs", "cs-CZ", langCs],
	["de", "de-DE", langDe],
	["es", "es-ES", langEs],
	["et", "et-EE", langEt],
	["fr", "fr-FR", langFr],
	["ga", "ga-IE", langGa],
	["hu", "hu-HU", langHu],
	["id", "id-ID", langId],
	["it", "it-IT", langIt],
	["ja", "ja-JP", langJa],
	["ko", "ko-KR", langKo],
	["nl", "nl-NL", langNl],
	["no", "no-NO", langNo],
	["pl", "pl-PL", langPl],
	["pt", "pt-PT", langPt],
	["ru", "ru-RU", langRu],
	["sk", "sk-SK", langSk],
	["tr", "tr-TR", langTr],
	["vi", "vi-VN", langVi],
	["zh", "zh-CN", langZh],
];

const loadMessages = (locale?: string): typeof langList & typeof langEn => {
	const thisLocale = (locale || "en").slice(0, 2);

	// ensure this lang exists in localeOptions above, otherwise fallback to en
	if (thisLocale === "en" || !localeOptions.some(([code]) => code === thisLocale)) {
		return { ...langList, ...langEn };
	}

	return Object.assign({}, langList, langEn, localeOptions.find(([code]) => code === thisLocale)?.[2]);
};

const getLocale = (short = false) => {
	let loc = window.localStorage.getItem("locale");
	if (!loc) loc = document.documentElement.lang;
	if (short) return loc.slice(0, 2);
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

//console.log("L:", localeOptions);

export { changeLocale, getLocale, intl, localeOptions, T };
