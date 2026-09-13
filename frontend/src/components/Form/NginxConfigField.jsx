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
						className="form-control"
						spellCheck={false}
						placeholder={intl.formatMessage({ id: "nginx-config.placeholder" })}
						style={{
							fontFamily: "ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace",
							borderRadius: "0.3rem",
							minHeight: "200px",
							backgroundColor: "var(--tblr-bg-surface-dark)",
						}}
						{...field}
					/>
				</div>
			)}
		</Field>
	);
}
