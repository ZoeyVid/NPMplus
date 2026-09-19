import { IconInfoCircle, IconSettings, IconX } from "@tabler/icons-react";
import { Field, useFormikContext } from "formik";
import { useState } from "react";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import Popover from "react-bootstrap/Popover";
import { intl, T } from "src/locale";

const BACKUP_INCOMPATIBLE_METHODS = ["ip_hash"];

function InfoPopover({ messageId }) {
	const popover = (
		<Popover>
			<Popover.Body>{intl.formatMessage({ id: messageId })}</Popover.Body>
		</Popover>
	);
	return (
		<OverlayTrigger trigger={["hover", "focus"]} placement="top" overlay={popover}>
			<span className="ms-1 text-muted" style={{ cursor: "help" }}>
				<IconInfoCircle size={14} />
			</span>
		</OverlayTrigger>
	);
}

export function ForwardHostFields({ initialServers = [], initialMethod = "round_robin" }) {
	const [servers, setServers] = useState(initialServers);
	const [method, setMethod] = useState(initialMethod);
	const { setFieldValue } = useFormikContext();

	const blankServer = {
		host: "",
		port: 80,
		weight: 1,
		maxFails: 1,
		failTimeout: "30s",
		backup: false,
		down: false,
	};

	const syncField = (newServers, newMethod) => {
		const filtered = newServers.filter((s) => s.host.trim() !== "");
		setFieldValue("npmplusUpstreamServers", filtered);
		setFieldValue("npmplusLoadBalanceMethod", newMethod);
	};

	const handleAdd = () => {
		const updated = [...servers, blankServer];
		setServers(updated);
	};

	const handleRemove = (idx) => {
		const updated = servers.filter((_, i) => i !== idx);
		setServers(updated);
		syncField(updated, method);
	};

	const handleChange = (idx, field, value) => {
		const updated = servers.map((s, i) => (i === idx ? { ...s, [field]: value } : s));
		setServers(updated);
		syncField(updated, method);
	};

	const handleMethodChange = (newMethod) => {
		let updated = servers;
		if (BACKUP_INCOMPATIBLE_METHODS.includes(newMethod)) {
			updated = servers.map((s) => ({ ...s, backup: false }));
			setServers(updated);
		}
		setMethod(newMethod);
		syncField(updated, newMethod);
	};

	const backupDisabled = BACKUP_INCOMPATIBLE_METHODS.includes(method);

	if (servers.length === 0) {
		return (
			<div className="text-center">
				<p className="text-muted mt-3">
					<T id="upstream.description" />
				</p>
				<button type="button" className="btn my-2" onClick={handleAdd}>
					<T id="upstream.add-server" />
				</button>
			</div>
		);
	}

	return (
		<>
			<div className="row">
				<div className="col-md-3">
					<Field name="forwardScheme">
						{({ field, form }) => (
							<div className="mb-3">
								<label
									className="form-label"
									htmlFor="forwardScheme"
								>
									<T id="host.forward-scheme" />
								</label>
								<select
									id="forwardScheme"
									className="form-select"
									required
									{...field}
									onChange={(e) => {
										field.onChange(e);
										const scheme = e.target.value;
										if (scheme === "empty") return;
										if (!["http", "https"].includes(scheme)) {
											form.setFieldValue(
												"npmplusProxyRequestBuffering",
												false,
											);
											form.setFieldValue(
												"npmplusProxyResponseBuffering",
												false,
											);
										}
										if (scheme === "path") {
											form.setFieldValue(
												"npmplusUpstreamCompression",
												false,
											);
										} else {
											form.setFieldValue(
												"npmplusFancyindex",
												false,
											);
										}
									}}
								>
									<option value="http">http://</option>
									<option value="https">https://</option>
									<option value="path">path: </option>
									<option value="empty">empty</option>
									<option value="grpc">grpc://</option>
									<option value="grpcs">grpcs://</option>
								</select>
							</div>
						)}
					</Field>
				</div>
				{initialServers.length > 1 ? (
					<>
						<div className="col-md-10">
							<label className="form-label" htmlFor="lbMethod">
								<T id="host.load-balance-method" />
								<InfoPopover messageId="host.load-balance-method-help" />
							</label>
						</div>
						<div className="col-md-10">
							<Field name="npmplusLoadBalanceMethod">
								<div className="input-group mb-3 shadow-none">
									<select
										id="npmplusLoadBalanceMethod"
										className="form-select"
										value={method}
										onChange={(e) => handleMethodChange(e.target.value)}
									>
										<option value="round_robin">Round Robin</option>
										<option value="least_conn">Least Connections</option>
										<option value="ip_hash">IP Hash (sticky sessions)</option>
									</select>
								</div>
							</Field>
						</div>
					</>
				) : null}
			</div>
			{servers.map((server, idx) => (
				<div className="row">
					<div className="row">
						
						<div className="col-md-5">
							<Field name="forwardHost">
								{({ field, form }) => (
									<div className="mb-3">
										<label className="form-label" htmlFor="forwardHost">
											<T id="proxy-host.forward-host-path" />
										</label>
										<input
											id="forwardHost"
											type="text"
											className={`form-control ${form.errors.forwardHost && form.touched.forwardHost ? "is-invalid" : ""}`}
											placeholder="example.com"
											{...field}
										/>

										{form.errors.forwardHost ? (
											<div className="invalid-feedback">
												{form.errors.forwardHost &&
												form.touched.forwardHost
													? form.errors.forwardHost
													: null}
											</div>
										) : null}
									</div>
								)}
							</Field>
						</div>
						<div className="col-md-3">
							<Field name="forwardPort" validate={validateNumber(-1, 65535)}>
								{({ field, form }) => (
									<div className="mb-3">
										<label className="form-label" htmlFor="forwardPort">
											<T id="host.forward-port" />
										</label>
										<input
											id="forwardPort"
											type="text"
											inputMode="numeric"
											pattern="[0-9]*"
											className={`form-control ${form.errors.forwardPort && form.touched.forwardPort ? "is-invalid" : ""}`}
											placeholder="eg: 8081"
											{...field}
										/>

										{form.errors.forwardPort ? (
											<div className="invalid-feedback">
												{form.errors.forwardPort &&
												form.touched.forwardPort
													? form.errors.forwardPort
													: null}
											</div>
										) : null}
									</div>
								)}
							</Field>
						</div>
						{initialServers.length > 1 ? (
							<button
								type="button"
								aria-label="Remove"
								className="btn btn-ghost btn-danger p-0 mb-1"
								onClick={() => {
									handleRemove(idx);
								}}
							>
								<IconX size={16} />
							</button>
						) : null}
					</div>
					<div className="row">
						<div className="col-md-3">
							<Field name="npmplusUpstreamWeight" validate={validateNumber(-1, 65535)}>
								{({ field, form }) => (
									<div className="mb-3">
										<label className="form-label" htmlFor="npmplusUpstreamWeight">
											<T id="host.upstream-weight" />
										</label>
										<input
											id="npmplusUpstreamWeight"
											type="text"
											inputMode="numeric"
											pattern="[0-9]*"
											className={`form-control ${form.errors.npmplusUpstreamWeight && form.touched.npmplusUpstreamWeight ? "is-invalid" : ""}`}
											placeholder="eg: 1"
											{...field}
										/>

										{form.errors.npmplusUpstreamWeight ? (
											<div className="invalid-feedback">
												{form.errors.npmplusUpstreamWeight &&
												form.touched.npmplusUpstreamWeight
													? form.errors.npmplusUpstreamWeight
													: null}
											</div>
										) : null}
									</div>
								)}
							</Field>
						</div>
						<div className="col-md-3">
							<Field name="npmplusUpstreamMaxFails" validate={validateNumber(-1, 65535)}>
								{({ field, form }) => (
									<div className="mb-3">
										<label className="form-label" htmlFor="npmplusUpstreamMaxFails">
											<T id="host.upstream-max-fails" />
										</label>
										<input
											id="npmplusUpstreamMaxFails"
											type="text"
											inputMode="numeric"
											pattern="[0-9]*"
											className={`form-control ${form.errors.npmplusUpstreamMaxFails && form.touched.npmplusUpstreamMaxFails ? "is-invalid" : ""}`}
											placeholder="eg: 1"
											{...field}
										/>

										{form.errors.npmplusUpstreamMaxFails ? (
											<div className="invalid-feedback">
												{form.errors.npmplusUpstreamMaxFails &&
												form.touched.npmplusUpstreamMaxFails
													? form.errors.npmplusUpstreamMaxFails
													: null}
											</div>
										) : null}
									</div>
								)}
							</Field>
						</div>
						<div className="col-md-3">
							<Field name="npmplusUpstreamTimeoutSec" validate={validateNumber(-1, 65535)}>
								{({ field, form }) => (
									<div className="mb-3">
										<label className="form-label" htmlFor="npmplusUpstreamTimeoutSec">
											<T id="host.upstream-timeout-sec" />
										</label>
										<input
											id="npmplusUpstreamTimeoutSec"
											type="text"
											inputMode="numeric"
											pattern="[0-9]*"
											className={`form-control ${form.errors.npmplusUpstreamTimeoutSec && form.touched.npmplusUpstreamTimeoutSec ? "is-invalid" : ""}`}
											placeholder="eg: 1"
											{...field}
										/>

										{form.errors.npmplusUpstreamTimeoutSec ? (
											<div className="invalid-feedback">
												{form.errors.npmplusUpstreamTimeoutSec &&
												form.touched.npmplusUpstreamTimeoutSec
													? form.errors.npmplusUpstreamTimeoutSec
													: null}
											</div>
										) : null}
									</div>
								)}
							</Field>
						</div>
						<div className="col-md-3">
							<label className="row" htmlFor="npmplusUpstreamBackup">
								<span className="col">
									<T id="host.flags.send-noindex" />
								</span>
								<span className="col-auto">
									<Field name="npmplusUpstreamBackup" type="checkbox">
										{({ field }) => (
											<span className="form-check form-check-single form-switch">
												<input
													{...field}
													id="npmplusUpstreamBackup"
													className={cn("form-check-input", {
														"bg-lime": field.checked,
													})}
													type="checkbox"
												/>
											</span>
										)}
									</Field>
								</span>
							</label>
						</div>
						<div className="col-md-3">
							<label className="row" htmlFor="npmplusUpstreamDisable">
								<span className="col">
									<T id="host.flags.send-noindex" />
								</span>
								<span className="col-auto">
									<Field name="npmplusUpstreamDisable" type="checkbox">
										{({ field }) => (
											<span className="form-check form-check-single form-switch">
												<input
													{...field}
													id="npmplusUpstreamDisable"
													className={cn("form-check-input", {
														"bg-lime": field.checked,
													})}
													type="checkbox"
												/>
											</span>
										)}
									</Field>
								</span>
							</label>
						</div>
					</div>
				</div>
			))}

			<div>
				<button type="button" className="btn btn-sm" onClick={handleAdd}>
					<T id="host.add-server" />
				</button>
			</div>
		</>
	);
}
