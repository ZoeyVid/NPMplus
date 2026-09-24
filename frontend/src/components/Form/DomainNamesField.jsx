import { Field, useFormikContext } from "formik";
import CreatableSelect from "react-select/creatable";
import { intl, T } from "src/locale";
import { validateDomain, validateDomains } from "src/modules/Validations";

export function DomainNamesField({
	name = "domainNames",
	label = "domain-names",
	id = "domainNames",
	maxDomains,
	isWildcardPermitted = false,
	dnsProviderWildcardSupported = false,
	onChange,
}) {
	const { setFieldValue } = useFormikContext();

	const handleChange = (v, _actionMeta) => {
		const doms = v?.map((i) => i.value.trim());
		void setFieldValue(name, doms);
		onChange?.(doms);
	};

	const helperTexts = [];
	if (maxDomains) {
		helperTexts.push(<T id="domain-names.max" data={{ count: maxDomains }} />);
	}
	if (!isWildcardPermitted) {
		helperTexts.push(<T id="domain-names.wildcards-not-permitted" />);
	} else if (!dnsProviderWildcardSupported) {
		helperTexts.push(<T id="domain-names.wildcards-not-supported" />);
	}

	return (
		<Field name={name} validate={validateDomains(isWildcardPermitted && dnsProviderWildcardSupported, maxDomains)}>
			{({ field, form }) => (
				<div className="mb-3">
					<label className="form-label" htmlFor={id}>
						<T id={label} />
					</label>
					<CreatableSelect
						className="react-select-container"
						classNamePrefix="react-select"
						name={field.name}
						id={id}
						closeMenuOnSelect={true}
						isClearable={false}
						isValidNewOption={validateDomain(isWildcardPermitted && dnsProviderWildcardSupported)}
						isMulti
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
