import type React from "react";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

const StorageKey = "tabler-theme";
const Light = "light";
const Dark = "dark";

// Define theme types
type Theme = "light" | "dark";

interface ThemeContextType {
	theme: Theme;
	toggleTheme: () => void;
	setTheme: (theme: Theme) => void;
	getTheme: () => Theme;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
	children: ReactNode;
}

const getBrowserDefault = (): Theme => {
	if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
		return Dark;
	}
	return Light;
};

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
	const [theme, setThemeState] = useState<Theme>(() => {
		// Try to read theme from localStorage or use the browser default
		const stored = localStorage.getItem(StorageKey) as Theme | null;
		return stored || getBrowserDefault();
	});

	useEffect(() => {
		document.body.dataset.theme = theme;
		document.body.classList.remove(theme === Light ? Dark : Light);
		document.body.classList.add(theme);
		localStorage.setItem(StorageKey, theme);
		for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'))
			meta.media = meta.dataset.theme === theme ? "all" : "not all";
	}, [theme]);

	const toggleTheme = () => {
		setThemeState((prev) => (prev === Light ? Dark : Light));
	};

	const setTheme = (newTheme: Theme) => {
		setThemeState(newTheme);
	};

	const getTheme = () => theme;

	document.documentElement.setAttribute("data-bs-theme", theme);
	return <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, getTheme }}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextType {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error("useTheme must be used within a ThemeProvider");
	}
	return context;
}
