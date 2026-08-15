import { useTheme as useThemeContext } from "src/context";

// Simple hook wrapper for clarity and scalability
const useTheme = () => useThemeContext();

export { useTheme };
