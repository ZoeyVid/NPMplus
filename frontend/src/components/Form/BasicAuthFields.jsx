import { IconArrowDown, IconArrowUp, IconEye, IconEyeOff, IconX } from "@tabler/icons-react";
import { Field, FieldArray, useFormikContext } from "formik";
import { useState } from "react";
import { intl, T } from "src/locale";

const blankItem = { username: "", password: "" };

export const toItemRows = (items) => (items.length ? items : [blankItem]);

export function BasicAuthFields({ name = "items" }) {
	const [revealed, setRevealed] = useState([]);
	const { values, initialValues } = useFormikContext();
	const items = values[name];
	const storedUsernames = new Set(initialValues[name].map(({ username }) => username).filter(Boolean));

	return (
		<>
			<div className="row">
				<div className="col-4">
					<div className="form-label">
						<T id="username" />
					</div>
				</div>
				<div className="col-8">
					<div className="form-label">
						<T id="password" />
					</div>
				</div>
			</div>
			<FieldArray name={name} validateOnChange={false}>
				{({ push, remove, replace, swap }) => (
					<>
						{items.map((item, idx) => (
							<div className="row mb-3" key={idx}>
								<div className="col-4">
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
								<div className="col-4">
									<div className="input-group input-group-flat">
										<Field name={`${name}.${idx}.password`}>
											{({ field }) => (
												<input
													type={revealed[idx] ? "text" : "password"}
													autoComplete="new-password"
													className="form-control"
													ref={(input) => {
														if (new TextEncoder().encode(item.password).length > 72) {
															input?.setCustomValidity(
																intl.formatMessage(
																	{ id: "error.max-byte-length" },
																	{ max: 72 },
																),
															);
														} else {
															input?.setCustomValidity("");
														}
													}}
													required={
														item.username.trim() !== "" &&
														!storedUsernames.has(item.username)
													}
													{...field}
													placeholder={storedUsernames.has(item.username) ? "••••••••" : ""}
												/>
											)}
										</Field>

										<span className="input-group-text">
											<button
												type="button"
												title={intl.formatMessage({
													id: revealed[idx] ? "password.hide" : "password.show",
												})}
												onMouseDown={(e) => e.preventDefault()}
												className="p-0 border-0 bg-transparent text-secondary d-flex align-items-center cursor-pointer"
												onClick={() =>
													setRevealed((r) => Object.assign([...r], { [idx]: !r[idx] }))
												}
											>
												{revealed[idx] ? <IconEyeOff size={18} /> : <IconEye size={18} />}
											</button>
										</span>
									</div>
								</div>
								<div className="col-4 d-flex gap-1">
									{idx > 0 && (
										<button
											type="button"
											title={intl.formatMessage({ id: "action.move-up" })}
											className="btn"
											onClick={() => {
												swap(idx - 1, idx);
												setRevealed(
													Object.assign([...revealed], {
														[idx - 1]: revealed[idx],
														[idx]: revealed[idx - 1],
													}),
												);
											}}
										>
											<IconArrowUp size={16} />
										</button>
									)}
									{idx < items.length - 1 && (
										<button
											type="button"
											title={intl.formatMessage({ id: "action.move-down" })}
											className="btn"
											onClick={() => {
												swap(idx, idx + 1);
												setRevealed(
													Object.assign([...revealed], {
														[idx]: revealed[idx + 1],
														[idx + 1]: revealed[idx],
													}),
												);
											}}
										>
											<IconArrowDown size={16} />
										</button>
									)}
									<button
										type="button"
										title={intl.formatMessage({ id: "action.delete" })}
										className="btn btn-ghost btn-danger p-0 ms-auto"
										onClick={() => {
											if (items.length === 1) {
												replace(idx, blankItem);
											} else {
												remove(idx);
											}
											setRevealed(revealed.toSpliced(idx, 1));
										}}
									>
										<IconX size={16} />
									</button>
								</div>
							</div>
						))}
						<div>
							<button type="button" className="btn btn-sm" onClick={() => push(blankItem)}>
								<T id="action.add" />
							</button>
						</div>
					</>
				)}
			</FieldArray>
		</>
	);
}
