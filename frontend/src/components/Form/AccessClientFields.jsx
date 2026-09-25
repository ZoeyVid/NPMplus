import { IconX } from "@tabler/icons-react";
import cn from "clsx";
import { useFormikContext } from "formik";
import { useState } from "react";
import { intl, T } from "src/locale";

export function AccessClientFields({ initialValues, name = "clients" }) {
	const initial = initialValues || [];
	const [values, setValues] = useState(
		initial.at(-1)?.address?.trim().toLowerCase() === "all"
			? initial
			: [...initial, { directive: "deny", address: "all" }],
	);
	const { setFieldValue } = useFormikContext();

	const blankClient = { directive: "allow", address: "" };

	if (values?.length === 1) {
		setValues([blankClient, ...values]);
	}

	const handleAdd = () => {
		setValues(values.toSpliced(values.length - 1, 0, blankClient));
	};

	const handleRemove = (idx) => {
		const newValues = values.toSpliced(idx, 1);
		if (newValues.length === 1) {
			newValues.splice(newValues.length - 1, 0, blankClient);
		}
		setValues(newValues);
		setFormField(newValues);
	};

	const handleChange = (idx, field, fieldValue) => {
		const newValues = values.with(idx, { ...values[idx], [field]: fieldValue });
		setValues(newValues);
		setFormField(newValues);
	};

	const setFormField = (newValues) => {
		const filtered = newValues.filter((v) => v?.address?.trim() !== "");
		void setFieldValue(name, filtered);
	};

	return (
		<>
			<p className="text-secondary">
				<T id="access-list.help.rules-order" />
			</p>
			{values.slice(0, -1).map((client, idx) => (
				<div className="row mb-1" key={idx}>
					<div className="col-11">
						<div className="input-group mb-2">
							<select
								className={cn(
									"form-select",
									"w-auto",
									"flex-grow-0",
									client.directive === "allow" ? "bg-lime-lt" : "bg-orange-lt",
								)}
								name={`clients[${idx}].directive`}
								value={client.directive}
								onChange={(e) => handleChange(idx, "directive", e.target.value)}
							>
								<option value="allow">
									<T id="action.allow" />
								</option>
								<option value="deny">
									<T id="action.deny" />
								</option>
							</select>
							<input
								name={`clients[${idx}].address`}
								type="text"
								className="form-control"
								autoComplete="off"
								pattern="[^lL]+"
								value={client.address}
								onChange={(e) => handleChange(idx, "address", e.target.value)}
								placeholder={intl.formatMessage({
									id: "access-list.rule-source.placeholder",
								})}
							/>
						</div>
					</div>
					<div className="col-1">
						<button
							type="button"
							className="btn btn-ghost btn-danger p-0"
							onClick={() => handleRemove(idx)}
						>
							<IconX size={16} />
						</button>
					</div>
				</div>
			))}
			<div className="mb-3">
				<button type="button" className="btn btn-sm" onClick={handleAdd}>
					<T id="action.add" />
				</button>
			</div>
			<div className="row mb-3">
				<p className="text-secondary">
					<T id="access-list.help.rules-last" />
				</p>
				<div className="col-11">
					<div className="input-group mb-2">
						<select
							className={cn(
								"form-select",
								"w-auto",
								"flex-grow-0",
								values[values.length - 1].directive === "allow" ? "bg-lime-lt" : "bg-orange-lt",
							)}
							name="clients[last].directive"
							value={values[values.length - 1].directive}
							onChange={(e) => handleChange(values.length - 1, "directive", e.target.value)}
						>
							<option value="allow">
								<T id="action.allow" />
							</option>
							<option value="deny">
								<T id="action.deny" />
							</option>
						</select>
						<input
							name="clients[last].address"
							type="text"
							className="form-control"
							autoComplete="off"
							value="all"
							disabled
						/>
					</div>
				</div>
			</div>
		</>
	);
}
