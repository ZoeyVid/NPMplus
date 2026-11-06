import { Field } from "formik";
import { useUser } from "src/hooks";
import { intl, T } from "src/locale";
import { isAdmin } from "src/modules/Permissions";

export function NginxConfigField({ name = "advancedConfig", label = "nginx-config.label", id = "advancedConfig" }) {
	const { data: currentUser } = useUser("me");
	return (
		<Field name={name}>
			{({ field }) => (
				<div className="mt-3">
					<label htmlFor={id} className="form-label">
						<T id={label} />
					</label>
					<textarea
						id={id}
						className="form-control font-monospace"
						spellCheck={false}
						placeholder={intl.formatMessage({ id: "nginx-config.placeholder" })}
						rows={9}
						disabled={!isAdmin(currentUser?.roles)}
						{...field}
					/>
				</div>
			)}
		</Field>
	);
}
