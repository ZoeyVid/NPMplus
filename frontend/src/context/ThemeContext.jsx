import { createContext, useContext, useEffect, useState } from "react";

const StorageKey = "tabler-theme";
const Light = "light";
const Dark = "dark";

const ThemeContext = createContext(undefined);

export const ThemeProvider = ({ children }) => {
	const [theme, setTheme] = useState(() => {
		// Try to read theme from localStorage or use the browser default
		return (
			localStorage.getItem(StorageKey) ||
			(window.matchMedia("(prefers-color-scheme: dark)").matches ? Dark : Light)
		);
	});

	useEffect(() => {
		document.body.dataset.theme = theme;
		document.body.classList.remove(theme === Light ? Dark : Light);
		document.body.classList.add(theme);
		localStorage.setItem(StorageKey, theme);
		for (const meta of document.querySelectorAll('meta[name="theme-color"]'))
			meta.media = meta.dataset.theme === theme ? "all" : "not all";
	}, [theme]);

	document.documentElement.setAttribute("data-bs-theme", theme);
	return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
};

export function useThemeState() {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error("useThemeState must be used within a ThemeProvider");
	}
	return context;
}
