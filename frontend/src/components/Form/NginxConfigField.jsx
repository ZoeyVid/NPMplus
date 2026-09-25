import { Field } from "formik";
import { intl, T } from "src/locale";

export function NginxConfigField({ name = "advancedConfig", label = "nginx-config.label", id = "advancedConfig" }) {
	return (
		<Field name={name}>
			{({ field }) => (
				<div className="mt-3">
					<label htmlFor={id} className="form-label">
						<T id={label} />
					</label>
					<textarea
						className="form-control font-monospace"
						spellCheck={false}
						placeholder={intl.formatMessage({ id: "nginx-config.placeholder" })}
						rows={9}
						{...field}
					/>
				</div>
			)}
		</Field>
	);
}
