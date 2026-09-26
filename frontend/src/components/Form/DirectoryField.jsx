import { Field } from "formik";
import { T } from "src/locale";

export function DirectoryField({
	labelId,
	datalistId,
	name = "npmplusDirectory",
	suggestions,
	placeholder = "eg: Production, Staging",
}) {
	return (
		<Field name={name}>
			{({ field }) => (
				<div>
					<label className="form-label" htmlFor={name}>
						<T id={labelId} />
					</label>
					<input
						id={name}
						type="text"
						className="form-control"
						placeholder={placeholder}
						list={datalistId}
						{...field}
						value={field.value || ""}
					/>

					<datalist id={datalistId}>
						{suggestions.map((dir) => (
							<option key={dir} value={dir} />
						))}
					</datalist>
				</div>
			)}
		</Field>
	);
}
