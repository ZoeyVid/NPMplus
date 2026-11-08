import cn from "clsx";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import Popover from "react-bootstrap/Popover";
import { DateFormatter } from "src/components";
import { T } from "src/locale";

const providerTranslations = {
	letsencrypt: "lets-encrypt",
	other: "certificates.custom",
	mtls: "mtls-certificate",
};

export function certificateProviderTranslation(provider) {
	return providerTranslations[provider];
}

export function CertificateFormatter({ certificate }) {
	if (!certificate) return <T id="no-tls" />;

	const popover = (
		<Popover id={`certificate-popover-${certificate.id}`}>
			<Popover.Body>
				<strong>
					<T id="column.name" />
				</strong>
				<div className="ms-1 mb-2">
					{certificate.provider !== "letsencrypt" && certificate.niceName && (
						<span className="badge bg-info-lt me-2">{certificate.niceName}</span>
					)}
					{certificate.domainNames.map((domain) => (
						<span key={domain} className="badge font-monospace me-2">
							{domain}
						</span>
					))}
				</div>
				<strong>
					<T id="column.provider" />
				</strong>
				<div className="ms-1 mb-2">
					<T id={certificateProviderTranslation(certificate.provider)} />
					{certificate.npmplusDnsChallenge && <> &ndash; {certificate.npmplusDnsProvider}</>}
				</div>
				<strong>
					<T id="column.expires" />
				</strong>
				<div className="ms-1 mb-2">
					<DateFormatter value={certificate.expiresOn} />
				</div>
				<strong>ID</strong>
				<div className="ms-1">{certificate.id}</div>
			</Popover.Body>
		</Popover>
	);

	return (
		<OverlayTrigger placement="bottom" overlay={popover}>
			<button type="button" className="p-0 border-0 bg-transparent text-reset text-start">
				<span className={cn({ "text-danger": Date.parse(certificate.expiresOn) < Date.now() })}>
					<T id={certificateProviderTranslation(certificate.provider)} />
				</span>
				{certificate.provider !== "letsencrypt" && certificate.niceName && (
					<div className="text-secondary small">{certificate.niceName}</div>
				)}
			</button>
		</OverlayTrigger>
	);
}
