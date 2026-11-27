import { fileURLToPath } from "node:url";
import frontendConfig from "../frontend/vite.config.js";

const fromRoot = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));

export default {
	...frontendConfig,
	root: fromRoot(""),
	resolve: {
		...frontendConfig.resolve,
		alias: {
			src: fromRoot("frontend/src"),
			translations: fromRoot("frontend/translations"),
		},
	},
	test: {
		environment: "jsdom",
		include: ["tests/frontend-*.test.jsx"],
	},
};
