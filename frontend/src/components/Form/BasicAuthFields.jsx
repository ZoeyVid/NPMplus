import { IconEye, IconEyeOff, IconX } from "@tabler/icons-react";
import { useFormikContext } from "formik";
import { useEffect, useState } from "react";
import { T } from "src/locale";

const blankItem = { username: "", password: "" };

export function BasicAuthFields({ initialValues, name = "items" }) {
	const [values, setValues] = useState(initialValues || []);
	const [revealed, setRevealed] = useState({});
	const { setFieldValue } = useFormikContext();

	useEffect(() => {
		if (values.length === 0) {
			setValues([blankItem]);
		}
	});

	const handleAdd = () => {
		setValues([...values, blankItem]);
	};

	const handleRemove = (idx) => {
		const newValues = values.filter((_, i) => i !== idx);
		if (newValues.length === 0) {
			newValues.push(blankItem);
		}
		setValues(newValues);
		setFormField(newValues);
	};

	const handleChange = (idx, field, fieldValue) => {
		const newValues = values.map((v, i) => (i === idx ? { ...v, [field]: fieldValue } : v));
		setValues(newValues);
		setFormField(newValues);
	};

	const setFormField = (newValues) => {
		const filtered = newValues.filter((v) => v?.username?.trim() !== "");
		void setFieldValue(name, filtered);
	};

	return (
		<>
			<div className="row">
				<div className="col-6">
					<div className="form-label">
						<T id="username" />
					</div>
				</div>
				<div className="col-6">
					<div className="form-label">
						<T id="password" />
					</div>
				</div>
			</div>
			{values.map((item, idx) => (
				<div className="row mb-3" key={idx}>
					<div className="col-6">
						<input
							type="text"
							autoComplete="off"
							className="form-control input-sm"
							value={item.username}
							onChange={(e) => handleChange(idx, "username", e.target.value)}
						/>
					</div>
					<div className="col-5">
						<div className="input-group input-group-flat">
							<input
								type={revealed[idx] ? "text" : "password"}
								autoComplete="off"
								className="form-control"
								value={item.password}
								placeholder={
									initialValues.filter((iv) => iv.username === item.username).length > 0
										? "••••••••"
										: ""
								}
								onChange={(e) => handleChange(idx, "password", e.target.value)}
							/>

							<span className="input-group-text">
								<button
									type="button"
									tabIndex={-1}
									aria-label="toggle visibility"
									className="p-0 border-0 bg-transparent text-secondary d-flex align-items-center cursor-pointer"
									onClick={() => setRevealed((r) => ({ ...r, [idx]: !r[idx] }))}
								>
									{revealed[idx] ? <IconEyeOff size={18} /> : <IconEye size={18} />}
								</button>
							</span>
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
			<div>
				<button type="button" className="btn btn-sm" onClick={handleAdd}>
					<T id="action.add" />
				</button>
			</div>
		</>
	);
}
