import { IconAlertTriangle } from "@tabler/icons-react";
import { Field, useFormikContext } from "formik";
import { useState } from "react";
import Select from "react-select";
import { useDnsProviders } from "src/hooks";
import { intl, T } from "src/locale";
import styles from "./DNSProviderFields.module.css";

export function DNSProviderFields({ showBoundaryBox = false }) {
	const { values, setFieldValue } = useFormikContext();
	const { data: dnsProviders, isLoading } = useDnsProviders();
	const [dnsProviderId, setDnsProviderId] = useState(null);

	const v = values || {};

	const handleChange = (newValue, _actionMeta) => {
		void setFieldValue("meta.dnsProvider", newValue?.value);
		void setFieldValue("meta.dnsProviderCredentials", newValue?.credentials);
		setDnsProviderId(newValue?.value);
	};

	const options =
		dnsProviders?.map((p) => ({
			value: p.id,
			label: p.name,
			credentials: p.credentials,
		})) || [];

	return (
		<div className={showBoundaryBox ? styles.dnsChallengeWarning : undefined}>
			<p className="text-warning">
				<IconAlertTriangle size={16} className="me-1" />
				<T id="certificates.dns.warning" />
			</p>

			<Field name="meta.dnsProvider">
				{({ field }) => (
					<div className="row">
						<label htmlFor="dnsProvider" className="form-label">
							<T id="certificates.dns.provider" />
						</label>
						<Select
							className="react-select-container"
							classNamePrefix="react-select"
							name={field.name}
							inputId="dnsProvider"
							closeMenuOnSelect={true}
							isClearable={false}
							placeholder={intl.formatMessage({
								id: "certificates.dns.provider.placeholder",
							})}
							isLoading={isLoading}
							isSearchable
							onChange={handleChange}
							options={options}
						/>
					</div>
				)}
			</Field>

			{dnsProviderId ? (
				<>
					<Field name="meta.dnsProviderCredentials">
						{({ field }) => (
							<div className="mt-3">
								<label htmlFor="dnsProviderCredentials" className="form-label">
									<T id="certificates.dns.credentials" />
								</label>
								<textarea
									className="form-control"
									spellCheck={false}
									id="dnsProviderCredentials"
									style={{
										fontFamily:
											"ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace",
										borderRadius: "0.3rem",
										minHeight: "130px",
										backgroundColor: "var(--tblr-bg-surface-dark)",
									}}
									value={v.meta.dnsProviderCredentials || ""}
									{...field}
								/>

								<div>
									<small className="text-muted">
										<T id="certificates.dns.credentials-note" />
									</small>
								</div>
								<div>
									<small className="text-danger">
										<T id="certificates.dns.credentials-warning" />
									</small>
								</div>
							</div>
						)}
					</Field>
					<Field name="meta.propagationSeconds">
						{({ field }) => (
							<div className="mt-3">
								<label htmlFor="propagationSeconds" className="form-label">
									<T id="certificates.dns.propagation-seconds" />
								</label>
								<input
									id="propagationSeconds"
									type="number"
									className="form-control"
									min={0}
									max={7200}
									{...field}
								/>

								<small className="text-muted">
									<T id="certificates.dns.propagation-seconds-note" />
								</small>
							</div>
						)}
					</Field>
				</>
			) : null}
		</div>
	);
}
