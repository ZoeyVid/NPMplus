import { useEffect } from "react";
import { useThemeState } from "src/context";
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";

const Swagger = () => {
	const { theme } = useThemeState();

	useEffect(() => {
		document.documentElement.classList.toggle("dark-mode", theme === "dark");
		document.documentElement.style.background = "transparent";
		return () => {
			document.documentElement.classList.remove("dark-mode");
			document.documentElement.style.removeProperty("background");
		};
	}, [theme]);

	return (
		<SwaggerUI
			url="/api/schema"
			plugins={[{ components: { authorizeBtn: () => null, authorizeOperationBtn: () => null } }]}
			defaultModelRendering="model"
			filter
			showCommonExtensions
			displayRequestDuration
			requestSnippetsEnabled
		/>
	);
};

export default Swagger;
