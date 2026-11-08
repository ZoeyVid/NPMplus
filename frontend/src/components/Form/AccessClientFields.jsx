import { IconArrowDown, IconArrowUp, IconX } from "@tabler/icons-react";
import cn from "clsx";
import { Field, FieldArray, useFormikContext } from "formik";
import { intl, T } from "src/locale";

const blankClient = { directive: "allow", address: "" };

export const toClientRows = (clients) => {
	const rows = [...clients];
	if (rows.at(-1)?.address.toLowerCase() !== "all") rows.push({ directive: "deny", address: "all" });
	if (rows.length === 1) rows.unshift(blankClient);
	return rows;
};

export function AccessClientFields({ name = "clients" }) {
	const { values } = useFormikContext();
	const clients = values[name];

	return (
		<>
			<p className="text-secondary">
				<T id="access-list.help.rules-order" />
			</p>
			<FieldArray name={name} validateOnChange={false}>
				{({ insert, remove, replace, swap }) => (
					<>
						{clients.slice(0, -1).map((_, idx) => (
							<div className="row mb-1" key={idx}>
								<div className="col-8">
									<div className="input-group mb-2">
										<Field name={`${name}.${idx}.directive`}>
											{({ field }) => (
												<select
													className={cn(
														"form-select",
														"w-auto",
														"flex-grow-0",
														field.value === "allow" ? "bg-lime-lt" : "bg-orange-lt",
													)}
													aria-label={intl.formatMessage({
														id: "access-list.rule-directive",
													})}
													{...field}
												>
													<option value="allow">
														<T id="action.allow" />
													</option>
													<option value="deny">
														<T id="action.deny" />
													</option>
												</select>
											)}
										</Field>
										<Field name={`${name}.${idx}.address`}>
											{({ field }) => (
												<input
													type="text"
													className="form-control"
													autoComplete="off"
													pattern="[^\slL]{1,255}"
													aria-label={intl.formatMessage({ id: "access-list.rule-source" })}
													{...field}
													placeholder={intl.formatMessage({
														id: "access-list.rule-source.placeholder",
													})}
												/>
											)}
										</Field>
									</div>
								</div>
								<div className="col-4 d-flex gap-1 mb-2">
									{idx > 0 && (
										<button
											type="button"
											aria-label="Move up"
											className="btn"
											onClick={() => swap(idx - 1, idx)}
										>
											<IconArrowUp size={16} />
										</button>
									)}
									{idx < clients.length - 2 && (
										<button
											type="button"
											aria-label="Move down"
											className="btn"
											onClick={() => swap(idx, idx + 1)}
										>
											<IconArrowDown size={16} />
										</button>
									)}
									<button
										type="button"
										className="btn btn-ghost btn-danger p-0 ms-auto"
										aria-label={intl.formatMessage({ id: "action.delete" })}
										onClick={() => (clients.length === 2 ? replace(idx, blankClient) : remove(idx))}
									>
										<IconX size={16} />
									</button>
								</div>
							</div>
						))}
						<div className="mb-3">
							<button
								type="button"
								className="btn btn-sm"
								onClick={() => insert(clients.length - 1, blankClient)}
							>
								<T id="action.add" />
							</button>
						</div>
					</>
				)}
			</FieldArray>
			<div className="row mb-3">
				<p className="text-secondary">
					<T id="access-list.help.rules-last" />
				</p>
				<div className="col-8">
					<div className="input-group mb-2">
						<Field name={`${name}.${clients.length - 1}.directive`}>
							{({ field }) => (
								<select
									className={cn(
										"form-select",
										"w-auto",
										"flex-grow-0",
										field.value === "allow" ? "bg-lime-lt" : "bg-orange-lt",
									)}
									aria-label={intl.formatMessage({ id: "access-list.rule-directive" })}
									{...field}
								>
									<option value="allow">
										<T id="action.allow" />
									</option>
									<option value="deny">
										<T id="action.deny" />
									</option>
								</select>
							)}
						</Field>
						<input
							type="text"
							className="form-control"
							autoComplete="off"
							aria-label={intl.formatMessage({ id: "access-list.rule-source" })}
							value="all"
							disabled
						/>
					</div>
				</div>
			</div>
		</>
	);
}
