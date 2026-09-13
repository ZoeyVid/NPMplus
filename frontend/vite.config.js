import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react()],
	define: {
		global: "globalThis",
	},
	resolve: {
		alias: {
			src: fileURLToPath(new URL("./src", import.meta.url)),
			translations: fileURLToPath(new URL("./translations", import.meta.url)),
		},
	},
});
