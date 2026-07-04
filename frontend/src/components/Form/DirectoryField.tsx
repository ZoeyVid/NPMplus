import { Field } from "formik";
import { T } from "src/locale";

interface Props {
	labelId: string;
	datalistId: string;
	name?: string;
	suggestions: string[];
	placeholder?: string;
}

export function DirectoryField({
	labelId,
	datalistId,
	name = "meta.directory",
	suggestions,
	placeholder = "eg: Production, Staging",
}: Props) {
	return (
		<Field name={name}>
			{({ field }: any) => (
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
