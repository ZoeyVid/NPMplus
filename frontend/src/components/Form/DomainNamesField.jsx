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
		<Field name={name}>
			{({ field }) => (
				<div className="mb-3">
					<label className="form-label" htmlFor={id}>
						<T id={label} />
					</label>
					<CreatableSelect
						ref={(select) =>
							select?.inputRef.setCustomValidity(
								validateDomains(
									field.value,
									isWildcardPermitted && dnsProviderWildcardSupported,
									forCertificate,
								) ?? "",
							)
						}
						unstyled
						classNames={selectClassNames}
						name={field.name}
						inputId={id}
						closeMenuOnSelect={true}
						isClearable={false}
						isValidNewOption={(input, selected) =>
							validateDomain(
								input,
								isWildcardPermitted && dnsProviderWildcardSupported,
								forCertificate,
							) && !selected.some(({ value }) => value.toLowerCase() === input.trim().toLowerCase())
						}
						isMulti
						required
						placeholder={intl.formatMessage({ id: "domain-names.placeholder" })}
						onChange={handleChange}
						value={field.value?.map((d) => ({ label: d, value: d }))}
					/>

					{helperTexts.map((i, idx) => (
						<small key={idx} className="text-info">
							{i}
						</small>
					))}
				</div>
			)}
		</Field>
	);
}
