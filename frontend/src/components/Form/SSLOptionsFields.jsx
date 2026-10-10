import cn from "clsx";
import { Field, useFormikContext } from "formik";
import { DNSProviderFields } from "src/components";
import { T } from "src/locale";

export function SSLOptionsFields({ forProxy, color }) {
	const { values: v, setFieldValue } = useFormikContext();

	const newCertificate = v?.certificateId === "new";
	const hasCertificate = newCertificate || v?.certificateId > 0;
	const {
		sslForced,
		npmplusHttp3Support,
		hstsEnabled,
		hstsSubdomains,
		npmplusDnsChallenge: dnsChallenge,
		npmplusReuseKey: reuseKey,
		npmplusMtlsCertificateId,
		npmplusMtlsVerifyClientOptional,
		npmplusMtlsBypassAuthRequest,
	} = v;

	const mtlsBypassAuthRequestPossible =
		npmplusMtlsVerifyClientOptional &&
		[v, ...(v.locations ?? [])].some(({ npmplusAuthRequest = "none" }) => npmplusAuthRequest !== "none");

	const handleToggleChange = (e, fieldName) => {
		void setFieldValue(fieldName, e.target.checked);
		if (fieldName === "npmplusDnsChallenge" && !e.target.checked) {
			void setFieldValue("npmplusDnsProvider", undefined);
			void setFieldValue("npmplusDnsProviderCredentials", undefined);
			void setFieldValue("npmplusPropagationSeconds", undefined);
		}
		if (fieldName === "sslForced" && !e.target.checked) {
			void setFieldValue("hstsEnabled", false);
			void setFieldValue("hstsSubdomains", false);
		}
		if (fieldName === "hstsEnabled" && !e.target.checked) {
			void setFieldValue("hstsSubdomains", false);
		}
	};

	const toggleClasses = "form-check-input";
	const toggleEnabled = cn(toggleClasses, color);

	const getHttpOptions = () => (
		<div>
			<div className="row">
				<div className="col-6">
					<Field name="sslForced">
						{({ field }) => (
							<label className="form-check form-switch mt-1">
								<input
									className={sslForced ? toggleEnabled : toggleClasses}
									type="checkbox"
									checked={sslForced}
									onChange={(e) => handleToggleChange(e, field.name)}
									disabled={!hasCertificate}
								/>

								<span className="form-check-label">
									<T id="domains.force-ssl" />
								</span>
							</label>
						)}
					</Field>
				</div>
				<div className="col-6">
					<Field name="npmplusHttp3Support">
						{({ field }) => (
							<label className="form-check form-switch mt-1">
								<input
									className={npmplusHttp3Support ? toggleEnabled : toggleClasses}
									type="checkbox"
									checked={npmplusHttp3Support}
									onChange={(e) => handleToggleChange(e, field.name)}
									disabled={!hasCertificate}
								/>

								<span className="form-check-label">
									<T id="domains.http3-support" />
								</span>
							</label>
						)}
					</Field>
				</div>
			</div>
			<div className="row">
				<div className="col-6">
					<Field name="hstsEnabled">
						{({ field }) => (
							<label className="form-check form-switch mt-1">
								<input
									className={hstsEnabled ? toggleEnabled : toggleClasses}
									type="checkbox"
									checked={hstsEnabled}
									onChange={(e) => handleToggleChange(e, field.name)}
									disabled={!hasCertificate || !sslForced}
								/>

								<span className="form-check-label">
									<T id="host.flags.hsts-enabled" />
								</span>
							</label>
						)}
					</Field>
				</div>
				<div className="col-6">
					<Field name="hstsSubdomains">
						{({ field }) => (
							<label className="form-check form-switch mt-1">
								<input
									className={hstsSubdomains ? toggleEnabled : toggleClasses}
									type="checkbox"
									checked={hstsSubdomains}
									onChange={(e) => handleToggleChange(e, field.name)}
									disabled={!hasCertificate || !hstsEnabled}
								/>

								<span className="form-check-label">
									<T id="host.flags.hsts-subdomains" />
								</span>
							</label>
						)}
					</Field>
				</div>
			</div>
		</div>
	);

	return (
		<div>
			<div className="row">
				<div className="col-6">
					<Field name="npmplusMtlsVerifyClientOptional">
						{({ field }) => (
							<label className="form-check form-switch mt-1">
								<input
									className={npmplusMtlsVerifyClientOptional ? toggleEnabled : toggleClasses}
									type="checkbox"
									checked={npmplusMtlsVerifyClientOptional}
									onChange={(e) => handleToggleChange(e, field.name)}
									disabled={!(v?.certificateId > 0 && npmplusMtlsCertificateId > 0)}
								/>

								<span className="form-check-label">
									<T id="domains.mtls-verify-client-optional" />
								</span>
							</label>
						)}
					</Field>
				</div>
				{forProxy ? (
					<div className="col-6">
						<Field name="npmplusMtlsBypassAuthRequest">
							{({ field }) => (
								<label className="form-check form-switch mt-1">
									<input
										className={
											npmplusMtlsBypassAuthRequest === true && mtlsBypassAuthRequestPossible
												? toggleEnabled
												: toggleClasses
										}
										type="checkbox"
										checked={npmplusMtlsBypassAuthRequest === true && mtlsBypassAuthRequestPossible}
										onChange={(e) => handleToggleChange(e, field.name)}
										disabled={!mtlsBypassAuthRequestPossible}
									/>

									<span className="form-check-label">
										<T id="domains.mtls-bypass-auth-request" />
									</span>
								</label>
							)}
						</Field>
					</div>
				) : null}
			</div>
			{getHttpOptions()}
			{newCertificate ? (
				<div className="row">
					<div className="col-6">
						<Field name="npmplusReuseKey">
							{({ field }) => (
								<label className="form-check form-switch mt-1">
									<input
										className={reuseKey ? toggleEnabled : toggleClasses}
										type="checkbox"
										checked={Boolean(reuseKey)}
										onChange={(e) => handleToggleChange(e, field.name)}
									/>

									<span className="form-check-label">
										<T id="domains.reuse-key" />
									</span>
								</label>
							)}
						</Field>
					</div>
					<div className="col-6">
						<Field name="npmplusDnsChallenge">
							{({ field }) => (
								<label className="form-check form-switch mt-1">
									<input
										className={dnsChallenge ? toggleEnabled : toggleClasses}
										type="checkbox"
										checked={Boolean(dnsChallenge)}
										onChange={(e) => handleToggleChange(e, field.name)}
									/>

									<span className="form-check-label">
										<T id="domains.use-dns" />
									</span>
								</label>
							)}
						</Field>
					</div>
					{dnsChallenge ? <DNSProviderFields showBoundaryBox /> : null}
				</div>
			) : null}
		</div>
	);
}
