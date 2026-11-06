import { IconEye, IconEyeOff, IconX } from "@tabler/icons-react";
import { Field, useFormikContext } from "formik";
import { useState } from "react";
import { intl, T } from "src/locale";

const blankItem = { username: "", password: "" };

export const toItemRows = (items) => (items.length ? items : [blankItem]);

export function BasicAuthFields({ initialValues, name = "items" }) {
	const [revealed, setRevealed] = useState([]);
	const { values, setFieldValue } = useFormikContext();
	const items = values[name];

	const handleRemove = (idx) => {
		void setFieldValue(name, toItemRows(items.toSpliced(idx, 1)));
		setRevealed(revealed.toSpliced(idx, 1));
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
			{items.map((item, idx) => (
				<div className="row mb-3" key={idx}>
					<div className="col-6">
						<Field name={`${name}.${idx}.username`}>
							{({ field }) => (
								<input
									type="text"
									autoComplete="off"
									className="form-control input-sm"
									pattern="[^:\p{Cc}]{1,255}"
									{...field}
								/>
							)}
						</Field>
					</div>
					<div className="col-5">
						<div className="input-group input-group-flat">
							<Field name={`${name}.${idx}.password`}>
								{({ field }) => (
									<input
										type={revealed[idx] ? "text" : "password"}
										autoComplete="new-password"
										className="form-control"
										ref={(input) =>
											input?.setCustomValidity(
												new TextEncoder().encode(item.password).length > 72
													? intl.formatMessage({ id: "error.max-byte-length" }, { max: 72 })
													: "",
											)
										}
										required={
											item.username.trim() !== "" &&
											!initialValues.some((iv) => iv.username === item.username)
										}
										{...field}
										placeholder={
											initialValues.some((iv) => iv.username === item.username) ? "••••••••" : ""
										}
									/>
								)}
							</Field>

							<span className="input-group-text">
								<button
									type="button"
									tabIndex={-1}
									aria-label="toggle visibility"
									className="p-0 border-0 bg-transparent text-secondary d-flex align-items-center cursor-pointer"
									onClick={() => setRevealed((r) => Object.assign([...r], { [idx]: !r[idx] }))}
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
				<button
					type="button"
					className="btn btn-sm"
					onClick={() => void setFieldValue(name, [...items, blankItem])}
				>
					<T id="action.add" />
				</button>
			</div>
		</>
	);
}
