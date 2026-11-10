import React from "react";
import ReactDOM from "react-dom/client";
import App from "src/App.jsx";
import { Page } from "src/components";
import { intl } from "src/locale";

import "@tabler/core";
import "@tabler/core/dist/css/tabler.min.css";
import "@tabler/core/dist/css/tabler-themes.min.css";
import "@tabler/core/dist/css/tabler-flags.min.css";
import "src/main.css";

const root = ReactDOM.createRoot(document.querySelector("#root"), {
	onUncaughtError: (error) =>
		root.render(
			<Page className="page-center">
				<title>{`NPMplus – ${intl.formatMessage({ id: "error" })}`}</title>
				<div className="container-tight py-4">
					<div className="empty">
						<div className="alert alert-danger text-break text-start w-100 mb-0">{error.message}</div>
					</div>
				</div>
			</Page>,
		),
});

root.render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
);
