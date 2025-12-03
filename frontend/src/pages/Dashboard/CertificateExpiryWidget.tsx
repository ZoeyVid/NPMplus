import { IconAlertTriangle, IconCertificate } from "@tabler/icons-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { Link } from "react-router-dom";
import { useCertificates } from "src/hooks";
import { T } from "src/locale";
import { CERTIFICATES, VIEW } from "src/modules/Permissions";
import { HasPermission } from "src/components";

dayjs.extend(relativeTime);

export const CertificateExpiryWidget = () => {
	const { data: certificates } = useCertificates();

	if (!certificates) {
		return null;
	}

	// Filter certificates expiring in the next 30 days or already expired
	const expiringCertificates = certificates
		.filter((cert) => {
			if (!cert.expiresOn) return false;
			const expires = dayjs(cert.expiresOn);
			const diff = expires.diff(dayjs(), "day");
			return diff <= 30;
		})
		.sort((a, b) => {
			return dayjs(a.expiresOn).diff(dayjs(b.expiresOn));
		})
		.slice(0, 5); // Show top 5

	if (expiringCertificates.length === 0) {
		return null;
	}

	return (
		<HasPermission section={CERTIFICATES} permission={VIEW} hideError>
			<div className="card" style={{ height: "100%" }}>
				<div className="card-header">
					<h3 className="card-title">
						<T id="dashboard.certificates-expiring" />
					</h3>
				</div>
				<div className="list-group list-group-flush list-group-hoverable">
					{expiringCertificates.map((cert) => {
						const expires = dayjs(cert.expiresOn);
						const diff = expires.diff(dayjs(), "day");
						const isExpired = diff < 0;

						return (
							<div key={cert.id} className="list-group-item">
								<div className="row align-items-center">
									<div className="col-auto">
										<span className={`avatar ${isExpired ? "bg-red" : "bg-warning"} text-white`}>
											{isExpired ? <IconAlertTriangle /> : <IconCertificate />}
										</span>
									</div>
									<div className="col text-truncate">
										<Link to={"/nginx/certificates"} className="text-reset d-block">
											{cert.niceName || cert.domainNames.join(", ")}
										</Link>
										<div className="d-block text-secondary text-truncate mt-n1">
											{cert.domainNames.join(", ")}
										</div>
									</div>
									<div className="col-auto">
										<div className={`text-${isExpired ? "red" : "warning"}`}>
											{isExpired ? (
												<T id="dashboard.expired" />
											) : (
												<T id="dashboard.days-left" data={{ days: diff }} />
											)}
										</div>
									</div>
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</HasPermission>
	);
};
