import React from "react";
import ReactDOM from "react-dom/client";
import App from "src/App.jsx";

import "@tabler/core";

await (document.dir === "rtl"
	? import("@tabler/core/dist/css/tabler.rtl.min.css")
	: import("@tabler/core/dist/css/tabler.min.css"));
await import("./App.css");

ReactDOM.createRoot(document.getElementById("root")).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
);
