import { useEffect, useRef } from "react";
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
	const main = useRef(null);
	const previous = useRef(pathname);

	useEffect(() => {
		document.title = `${intl.formatMessage({ id: titles[pathname.replace(trailingSlash, "") || "/"] ?? "notfound.title" })} – NPMplus`;
		if (previous.current !== pathname) main.current?.focus();
		previous.current = pathname;
		return () => {
			document.title = "NPMplus";
		};
	}, [pathname]);

	return (
		<main ref={main} tabIndex={-1} className="container-xl flex-fill py-3 min-w-0 overflow-x-auto">
			{children}
		</main>
	);
}
