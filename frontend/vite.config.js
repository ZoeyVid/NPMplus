import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import localeList from "./translations/lang-list.json" with { type: "json" };

export default defineConfig({
	plugins: [react()],
	define: {
		global: "globalThis",
	},
	resolve: {
		alias: {
			src: "/src",
			translations: "/translations",
		},
	},
	css: {
		postcss: {
			plugins: [
				{
					postcssPlugin: "used-flags-only",
					Rule: (rule) => {
						const flag = rule.selector.split(".flag-country-")[1];
						if (flag && !Object.values(localeList).some((locale) => locale.flag === flag)) rule.remove();
					},
				},
			],
		},
	},
});
