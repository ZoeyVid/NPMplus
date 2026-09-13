import { createContext, useContext, useEffect, useState } from "react";

const StorageKey = "tabler-theme";
const Light = "light";
const Dark = "dark";

const ThemeContext = createContext(undefined);

const getBrowserDefault = () => {
	if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
		return Dark;
	}
	return Light;
};

export const ThemeProvider = ({ children }) => {
	const [theme, setThemeState] = useState(() => {
		// Try to read theme from localStorage or use the browser default
		const stored = localStorage.getItem(StorageKey);
		return stored || getBrowserDefault();
	});

	useEffect(() => {
		document.body.dataset.theme = theme;
		document.body.classList.remove(theme === Light ? Dark : Light);
		document.body.classList.add(theme);
		localStorage.setItem(StorageKey, theme);
		for (const meta of document.querySelectorAll('meta[name="theme-color"]'))
			meta.media = meta.dataset.theme === theme ? "all" : "not all";
	}, [theme]);

	const toggleTheme = () => {
		setThemeState((prev) => (prev === Light ? Dark : Light));
	};

	const setTheme = (newTheme) => {
		setThemeState(newTheme);
	};

	const getTheme = () => theme;

	document.documentElement.setAttribute("data-bs-theme", theme);
	return <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, getTheme }}>{children}</ThemeContext.Provider>;
};

export function useTheme() {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error("useTheme must be used within a ThemeProvider");
	}
	return context;
}
