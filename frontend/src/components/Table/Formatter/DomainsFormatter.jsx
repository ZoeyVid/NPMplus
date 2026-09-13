import cn from "clsx";
import { useLocaleState } from "src/context";
import { formatDateTime, T } from "src/locale";

const DomainLink = ({ domain, color }) => {
	// when domain contains a wildcard, make the link go nowhere.
	// Apparently the domain can be null or undefined sometimes.
	if (!domain) return null;
	let onClick;
	if (domain.includes("*")) {
		onClick = (e) => e.preventDefault();
	}
	return (
		<a
			key={domain}
			href={`http://${domain}`}
			target="_blank"
			rel="noopener"
			onClick={onClick}
			className={cn("badge", color ? `bg-${color}-lt` : null, "domain-name", "me-2")}
		>
			{domain}
		</a>
	);
};

export function DomainsFormatter({ domains, createdOn, niceName, provider, color }) {
	const { locale } = useLocaleState();
	const elms = [];

	if ((!domains || domains.length === 0) && !niceName) {
		elms.push(
			<span key="nice-name" className="badge bg-danger-lt me-2">
				Unknown
			</span>,
		);
	}
	if (!domains || (niceName && provider !== "letsencrypt")) {
		elms.push(
			<span key="nice-name" className="badge bg-info-lt me-2">
				{niceName}
			</span>,
		);
	}

	if (domains) {
		elms.push(...domains.map((domain) => <DomainLink key={domain} domain={domain} color={color} />));
	}

	return (
		<div className="flex-fill">
			<div className="font-weight-medium">{...elms}</div>
			{createdOn ? (
				<div className="text-secondary mt-1">
					<T id="created-on" data={{ date: formatDateTime(createdOn, locale) }} />
				</div>
			) : null}
		</div>
	);
}
