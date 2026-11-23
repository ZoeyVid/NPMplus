import cn from "clsx";
import { formatDateTime, T } from "src/locale";

const DomainLink = ({ domain, color, ssl }) => {
	// when domain contains a wildcard, make the link go nowhere.
	let onClick;
	if (domain.includes("*")) {
		onClick = (e) => e.preventDefault();
	}
	return (
		<a
			key={domain}
			href={`${ssl ? "https" : "http"}://${domain}`}
			target="_blank"
			rel="noopener"
			onClick={onClick}
			className={cn("badge", color ? `bg-${color}-lt` : null, "font-monospace", "me-2")}
		>
			{domain}
		</a>
	);
};

export function DomainsFormatter({ domains, createdOn, niceName, provider, color, ssl }) {
	const elms = [];

	if (domains.length === 0 && !niceName) {
		elms.push(
			<span key="nice-name" className="badge bg-danger-lt me-2">
				<T id="unknown" />
			</span>,
		);
	}
	if (niceName && provider !== "letsencrypt") {
		elms.push(
			<span key="nice-name" className="badge bg-info-lt me-2">
				{niceName}
			</span>,
		);
	}

	elms.push(...domains.map((domain) => <DomainLink key={domain} domain={domain} color={color} ssl={ssl} />));

	return (
		<div className="flex-fill">
			<div className="font-weight-medium">{...elms}</div>
			<div className="text-secondary mt-1">
				<T id="created-on" data={{ date: formatDateTime(createdOn) }} />
			</div>
		</div>
	);
}
