import { Field, useFormikContext } from "formik";
import CreatableSelect from "react-select/creatable";
import { intl, T } from "src/locale";
import { selectClassNames } from "src/modules/Select";
import { validateDomain, validateDomains } from "src/modules/Validations";

export function DomainNamesField({
	name = "domainNames",
	label = "domain-names",
	id = "domainNames",
	isWildcardPermitted,
	dnsProviderWildcardSupported,
	forCertificate,
	onChange,
}) {
	const { setFieldValue } = useFormikContext();

	const handleChange = (v, _actionMeta) => {
		const doms = [...new Set(v?.map((i) => i.value.trim()))];
		void setFieldValue(name, doms);
		onChange?.(doms);
	};

	const helperTexts = [];
	if (!isWildcardPermitted) {
		helperTexts.push(<T id="domain-names.wildcards-not-permitted" />);
	} else if (!dnsProviderWildcardSupported) {
		helperTexts.push(<T id="domain-names.wildcards-not-supported" />);
	}

	return (
		<Field
			name={name}
			validate={validateDomains(isWildcardPermitted && dnsProviderWildcardSupported, forCertificate)}
		>
			{({ field, form }) => (
				<div className="mb-3 col-md-10">
					<label className="form-label" htmlFor={id}>
						<T id={label} />
					</label>
					<CreatableSelect
						unstyled
						classNames={selectClassNames}
						name={field.name}
						id={id}
						closeMenuOnSelect={true}
						isClearable={false}
						isValidNewOption={validateDomain(
							isWildcardPermitted && dnsProviderWildcardSupported,
							forCertificate,
						)}
						isMulti
						required
						placeholder={intl.formatMessage({ id: "domain-names.placeholder" })}
						onChange={handleChange}
						value={field.value?.map((d) => ({ label: d, value: d }))}
					/>

					{form.errors[field.name] && form.touched[field.name] ? (
						<small className="text-danger">{form.errors[field.name]}</small>
					) : helperTexts.length ? (
						helperTexts.map((i, idx) => (
							<small key={idx} className="text-info">
								{i}
							</small>
						))
					) : null}
				</div>
			)}
		</Field>
	);
}
