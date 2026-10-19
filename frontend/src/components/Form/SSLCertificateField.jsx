import { IconShield } from "@tabler/icons-react";
import { Field, useFormikContext } from "formik";
import Select, { components } from "react-select";
import { certificateProviderTranslation } from "src/components";
import { useCertificates, useUser } from "src/hooks";
import { formatDateTime, intl, T } from "src/locale";
import { CERTIFICATES, hasPermission, MANAGE } from "src/modules/Permissions";
import { selectClassNames } from "src/modules/Select";

const Option = (props) => (
	<components.Option {...props}>
		<div className="flex-fill">
			<div className="font-weight-medium">
				{props.data.icon} <strong>{props.data.label}</strong>
			</div>
			<div className="text-secondary mt-1 ps-3">{props.data.subLabel}</div>
		</div>
	</components.Option>
);

export function SSLCertificateField({
	name,
	label,
	id = "certificateId",
	allowNew,
	forHttp = true,
	mtlsName = "npmplusMtlsCertificateId",
	mtlsLabel = "mtls-certificate",
}) {
	const { isPending, isError, error, data } = useCertificates();
	const { data: user } = useUser("me");
	const { values: v, setFieldValue } = useFormikContext();

	const handleChange = (newValue, _actionMeta) => {
		void setFieldValue(name, newValue?.value);

		if (!(newValue?.value > 0)) {
			void setFieldValue(mtlsName, 0);
			void setFieldValue("npmplusMtlsVerifyClientOptional", false);
		}

		const {
			sslForced,
			npmplusHttp3Support,
			hstsEnabled,
			hstsSubdomains,
			npmplusReuseKey,
			npmplusDnsChallenge,
			npmplusDnsProvider,
			npmplusDnsProviderCredentials,
			npmplusPropagationSeconds,
		} = v;
		if (forHttp && !newValue?.value) {
			if (sslForced) void setFieldValue("sslForced", false);
			if (npmplusHttp3Support) void setFieldValue("npmplusHttp3Support", false);
			if (hstsEnabled) void setFieldValue("hstsEnabled", false);
			if (hstsSubdomains) void setFieldValue("hstsSubdomains", false);
		}
		if (newValue?.value !== "new") {
			if (npmplusReuseKey) void setFieldValue("npmplusReuseKey", undefined);
			if (npmplusDnsChallenge) void setFieldValue("npmplusDnsChallenge", undefined);
			if (npmplusDnsProvider) void setFieldValue("npmplusDnsProvider", undefined);
			if (npmplusDnsProviderCredentials) void setFieldValue("npmplusDnsProviderCredentials", undefined);
			if (npmplusPropagationSeconds !== undefined) void setFieldValue("npmplusPropagationSeconds", undefined);
		}
	};

	const options =
		data
			?.filter((cert) => cert.provider !== "mtls")
			.map((cert) => ({
				value: cert.id,
				label: cert.niceName,
				subLabel: `${intl.formatMessage({ id: certificateProviderTranslation(cert.provider) })} — ${intl.formatMessage({ id: "expires.on" }, { date: formatDateTime(cert.expiresOn) })}`,
				icon: <IconShield size={14} className="text-pink" />,
			})) || [];

	const mtlsOptions =
		data
			?.filter((cert) => cert.provider === "mtls")
			.map((cert) => ({
				value: cert.id,
				label: cert.niceName,
				subLabel: `${intl.formatMessage({ id: certificateProviderTranslation(cert.provider) })} — ${intl.formatMessage({ id: "expires.on" }, { date: formatDateTime(cert.expiresOn) })}`,
				icon: <IconShield size={14} className="text-pink" />,
			})) || [];

	// Prepend the Add New option
	if (allowNew && hasPermission(CERTIFICATES, MANAGE, user?.permissions, user?.roles)) {
		options?.unshift({
			value: "new",
			label: intl.formatMessage({ id: "certificates.request.title" }),
			subLabel: intl.formatMessage({ id: "certificates.request.subtitle" }),
			icon: <IconShield size={14} className="text-lime" />,
		});
	}

	// Prepend the None option
	options?.unshift({
		value: 0,
		label: intl.formatMessage({ id: "certificate.none.title" }),
		subLabel: forHttp
			? intl.formatMessage({ id: "certificate.none.subtitle.for-http" })
			: intl.formatMessage({ id: "certificate.none.subtitle" }),
		icon: <IconShield size={14} className="text-red" />,
	});

	mtlsOptions?.unshift({
		value: 0,
		label: intl.formatMessage({ id: "certificate.none.title" }),
		subLabel: intl.formatMessage({ id: "certificate.none.subtitle" }),
		icon: <IconShield size={14} className="text-red" />,
	});

	return (
		<>
			<Field name={name}>
				{({ field }) => (
					<div className="mb-3">
						<label className="form-label" htmlFor={id}>
							<T id={label} />
						</label>
						{isPending ? <div className="placeholder placeholder-lg col-12 my-3 placeholder-glow" /> : null}
						{isError ? (
							<div className="invalid-feedback d-block">
								<T id={error.message} />
							</div>
						) : null}
						{!isPending && !isError ? (
							<Select
								inputId={id}
								unstyled
								classNames={selectClassNames}
								value={
									options.find((o) => o.value === field.value) ??
									(field.value ? { value: field.value, label: `#${field.value}` } : options[0])
								}
								options={options}
								components={{ Option }}
								styles={{
									option: (base) => ({
										...base,
										height: "100%",
									}),
								}}
								onChange={handleChange}
								isDisabled={v?.udpForwarding}
							/>
						) : null}
					</div>
				)}
			</Field>
			<Field name={mtlsName}>
				{({ field }) => (
					<div className="mb-3">
						<label className="form-label" htmlFor="mtlsCertificate">
							<T id={mtlsLabel} />
						</label>
						{isPending ? <div className="placeholder placeholder-lg col-12 my-3 placeholder-glow" /> : null}
						{isError ? (
							<div className="invalid-feedback d-block">
								<T id={error.message} />
							</div>
						) : null}
						{!isPending && !isError ? (
							<Select
								inputId="mtlsCertificate"
								unstyled
								classNames={selectClassNames}
								value={
									mtlsOptions.find((o) => o.value === field.value) ??
									(field.value ? { value: field.value, label: `#${field.value}` } : mtlsOptions[0])
								}
								options={mtlsOptions}
								components={{ Option }}
								styles={{
									option: (base) => ({
										...base,
										height: "100%",
									}),
								}}
								onChange={(newValue) => {
									void setFieldValue(mtlsName, newValue?.value);
									if (!(newValue?.value > 0)) {
										void setFieldValue("npmplusMtlsVerifyClientOptional", false);
									}
								}}
								isDisabled={v?.udpForwarding || !(v?.certificateId > 0)}
							/>
						) : null}
					</div>
				)}
			</Field>
		</>
	);
}
