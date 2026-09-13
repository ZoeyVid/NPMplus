import { createContext, useContext, useState } from "react";
import { getLocale } from "src/locale";

const LocaleContext = createContext(null);

function LocaleProvider({ children }) {
	const [locale] = useState(getLocale());

	const value = { locale };

	return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

function useLocaleState() {
	const context = useContext(LocaleContext);
	if (!context) {
		throw new Error("useLocaleState must be used within a LocaleProvider");
	}
	return context;
}

export { LocaleProvider, useLocaleState };
