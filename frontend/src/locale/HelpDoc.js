import { currentLocale } from "./IntlProvider.jsx";

const helpDocs = import.meta.glob("../../translations/help/*/*.md", {
	eager: true,
	import: "default",
	query: "?raw",
});

export const getHelpFile = (section) => {
	const doc =
		helpDocs[`../../translations/help/${currentLocale}/${section}.md`] ??
		helpDocs[`../../translations/help/en/${section}.md`];
	if (!doc) throw new Error(`Cannot load help doc for ${currentLocale}-${section}`);
	return doc;
};
