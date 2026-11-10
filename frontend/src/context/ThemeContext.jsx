import { createContext, useContext, useState } from "react";

const StorageKey = "tabler-theme";
const Light = "light";
const Dark = "dark";

const ThemeContext = createContext(undefined);

const applyTheme = (theme) => {
	document.documentElement.setAttribute("data-bs-theme", theme);
	document.body.dataset.theme = theme;
	localStorage.setItem(StorageKey, theme);
	for (const meta of document.querySelectorAll('meta[name="theme-color"]'))
		meta.media = meta.dataset.theme === theme ? "all" : "not all";
};

// Try to read theme from localStorage or use the browser default
const initialTheme =
	localStorage.getItem(StorageKey) || (window.matchMedia("(prefers-color-scheme: dark)").matches ? Dark : Light);
applyTheme(initialTheme);

export const ThemeProvider = ({ children }) => {
	const [theme, setTheme] = useState(initialTheme);

	return (
		<ThemeContext.Provider
			value={{
				theme,
				setTheme: (newTheme) => {
					applyTheme(newTheme);
					setTheme(newTheme);
				},
			}}
		>
			{children}
		</ThemeContext.Provider>
	);
};

export const useThemeState = () => useContext(ThemeContext);
