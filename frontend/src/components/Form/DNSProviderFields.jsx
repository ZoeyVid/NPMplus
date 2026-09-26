import { IconAlertTriangle } from "@tabler/icons-react";
import { Field, useFormikContext } from "formik";
import { useState } from "react";
import Select from "react-select";
import { useDnsProviders } from "src/hooks";
import { intl, T } from "src/locale";
import { selectClassNames } from "src/modules/Select";

export function DNSProviderFields({ showBoundaryBox = false }) {
	const { values, setFieldValue } = useFormikContext();
	const { data: dnsProviders, isLoading } = useDnsProviders();
	const [dnsProviderId, setDnsProviderId] = useState(null);

	const v = values || {};

	const handleChange = (newValue, _actionMeta) => {
		void setFieldValue("npmplusDnsProvider", newValue?.value);
		void setFieldValue("npmplusDnsProviderCredentials", newValue?.credentials);
		setDnsProviderId(newValue?.value);
	};

	const options =
		dnsProviders?.map((p) => ({
			value: p.id,
			label: p.name,
			credentials: p.credentials,
		})) || [];

	return (
		<div className={showBoundaryBox ? "py-3 border border-orange border-opacity-10 rounded bg-cyan-lt" : undefined}>
			<p className="text-warning">
				<IconAlertTriangle size={16} className="me-1" />
				<T id="certificates.dns.warning" />
			</p>

			<Field name="npmplusDnsProvider">
				{({ field }) => (
					<div className="row">
						<label htmlFor="dnsProvider" className="form-label">
							<T id="certificates.dns.provider" />
						</label>
						<Select
							unstyled
							classNames={selectClassNames}
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
					<Field name="npmplusDnsProviderCredentials">
						{({ field }) => (
							<div className="mt-3">
								<label htmlFor="dnsProviderCredentials" className="form-label">
									<T id="certificates.dns.credentials" />
								</label>
								<textarea
									className="form-control font-monospace"
									spellCheck={false}
									id="dnsProviderCredentials"
									rows={6}
									value={v.npmplusDnsProviderCredentials || ""}
									{...field}
								/>

								<div>
									<small className="text-secondary">
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
					<Field name="npmplusPropagationSeconds">
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

								<small className="text-secondary">
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
