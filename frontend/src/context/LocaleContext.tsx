import { createContext, type ReactNode, useContext, useState } from "react";
import { getLocale } from "src/locale";

// Context
interface LocaleContextType {
	setLocale: (locale: string) => void;
	locale?: string;
}

const LocaleContext = createContext<LocaleContextType | null>(null);

// Provider
interface Props {
	children?: ReactNode;
}
function LocaleProvider({ children }: Props) {
	const [locale, setLocaleValue] = useState(getLocale());

	const setLocale = (newLocale: string) => {
		setLocaleValue(newLocale);
	};

	const value = { locale, setLocale };

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
