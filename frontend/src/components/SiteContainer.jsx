import { useEffect } from "react";
import { useLocation } from "react-router";
import { intl } from "src/locale";

const trailingSlash = /\/$/u;

const titles = {
	"/": "dashboard",
	"/certificates": "certificates",
	"/access": "access-lists",
	"/audit-log": "auditlogs",
	"/settings": "settings",
	"/users": "users",
	"/nginx/proxy": "proxy-hosts",
	"/nginx/redirection": "redirection-hosts",
	"/nginx/404": "dead-hosts",
	"/nginx/stream": "streams",
};

export function SiteContainer({ children }) {
	const { pathname } = useLocation();

	useEffect(() => {
		document.title = `NPMplus – ${intl.formatMessage({ id: titles[pathname.replace(trailingSlash, "") || "/"] ?? "notfound.title" })}`;
		return () => {
			document.title = "NPMplus";
		};
	}, [pathname]);

	return (
		<main tabIndex={-1} className="container-xl flex-fill py-3 min-w-0 overflow-x-auto">
			{children}
		</main>
	);
}
