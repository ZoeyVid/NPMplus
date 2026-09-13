const helpDocs = import.meta.glob("../../translations/help/*/*.md", {
	eager: true,
	import: "default",
	query: "?raw",
});

export const getHelpFile = (lang, section) => {
	const doc =
		helpDocs[`../../translations/help/${lang}/${section}.md`] ??
		helpDocs[`../../translations/help/en/${section}.md`];
	if (!doc) throw new Error(`Cannot load help doc for ${lang}-${section}`);
	return doc;
};
