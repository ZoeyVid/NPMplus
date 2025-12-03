import cn from "classnames";
import { type ReactNode, forwardRef, useState } from "react";
import Button from "react-bootstrap/Button";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import Popover from "react-bootstrap/Popover";
import { formatDateTime, T } from "src/locale";

interface Props {
	domains: string[];
	createdOn?: string;
	niceName?: string;
	provider?: string;
	color?: string;
}

interface DomainPreviewProps {
	domain: string;
	[key: string]: any;
}

const DomainPreview = forwardRef<HTMLDivElement, DomainPreviewProps>(({ domain, style, ...props }, ref) => {
	const [showPreview, setShowPreview] = useState(false);

	return (
		<Popover ref={ref} id={`popover-preview-${domain}`} style={{ ...style, maxWidth: "520px" }} {...props}>
			<Popover.Header as="h3">{domain}</Popover.Header>
			<Popover.Body style={{ padding: 0, minHeight: "50px", minWidth: "200px" }}>
				{!showPreview ? (
					<div className="p-3 text-center">
						<p className="small mb-2">
							<T id="preview.security-note" />
						</p>
						<Button size="sm" variant="primary" onClick={() => setShowPreview(true)}>
							<T id="preview.load" />
						</Button>
					</div>
				) : (
					<iframe
						src={`//${domain}`}
						style={{ width: "500px", height: "400px", border: "none" }}
						title={`Preview of ${domain}`}
						loading="lazy"
						sandbox="allow-same-origin allow-scripts allow-forms"
					/>
				)}
			</Popover.Body>
		</Popover>
	);
});

const DomainLink = ({ domain, color }: { domain?: string; color?: string }) => {
	if (!domain) return null;
	try {
		const isWildcard = domain.includes("*");
		let onClick: ((e: React.MouseEvent) => void) | undefined;
		if (isWildcard) {
			onClick = (e: React.MouseEvent) => e.preventDefault();
		}

		const link = (
			<a
				key={domain}
				href={`http://${domain}`}
				target="_blank"
				rel="noreferrer"
				onClick={onClick}
				className={cn("badge", color ? `bg-${color}-lt` : null, "domain-name", "me-2")}
			>
				{domain}
			</a>
		);

		if (isWildcard) {
			return link;
		}

		return (
			<OverlayTrigger
				trigger={["hover", "focus"]}
				placement="auto"
				overlay={<DomainPreview domain={domain} />}
				delay={{ show: 200, hide: 250 }}
			>
				{link}
			</OverlayTrigger>
		);
	} catch {
		return null;
	}
};

export function DomainsFormatter({ domains, createdOn, niceName, provider, color }: Props) {
	const elms: ReactNode[] = [];
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
		domains.map((domain: string) => elms.push(<DomainLink key={domain} domain={domain} color={color} />));
	}

	return (
		<div className="flex-fill">
			<div className="font-weight-medium">{...elms}</div>
			{createdOn ? (
				<div className="text-secondary mt-1">
					<T id="created-on" data={{ date: formatDateTime(createdOn) }} />
				</div>
			) : null}
		</div>
	);
}
