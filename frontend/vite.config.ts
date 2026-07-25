import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import "vitest/config";

export default defineConfig({
	plugins: [react()],
	define: {
		global: "globalThis",
	},
	resolve: {
		tsconfigPaths: true,
	},
	assetsInclude: ["**/*.md"],
	test: {
		environment: "happy-dom",
	},
});
