import { IconChevronDown, IconChevronRight, IconInfoCircle, IconTrash, IconX } from "@tabler/icons-react";
import { Field, useFormikContext } from "formik";
import cn from "clsx";
import { useState } from "react";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import Popover from "react-bootstrap/Popover";
import Select, { components } from "react-select";

import { intl, T } from "src/locale";
import { validateNumber } from "src/modules/Validations";

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


const LoadBalancerOption = (props) => (
	<components.Option {...props}>
		{OptionContent(props.data.label, props.data.subLabel, props.data.icon)}
	</components.Option>
);

export function ForwardHostFields({ scheme, loadBalanceMethod, upstreamServers }) {
	const [servers, setServers] = useState(upstreamServers);
	const [method, setMethod] = useState(loadBalanceMethod);
	const [expanded, setExpanded] = useState([0]);
	const { setFieldValue } = useFormikContext();

	const blankServer = {
		host: "",
		port: 80,
		weight: 1,
		maxFails: 1,
		failTimeout: "30s",
		backup: false,
		enabled: false,
	};

	const syncField = (newServers, newMethod) => {
		const filtered = newServers.filter((s) => s.host.trim() !== "");
		setFieldValue("npmplusUpstreamServers", filtered);
		setFieldValue("npmplusLoadBalanceMethod", newMethod);
	};

	const handleAdd = () => {
		const newServerIdx = servers.length;
    	const updated = [...servers, { ...blankServer }];
		setServers(updated);
		setExpanded((current) => [...current, newServerIdx]);
	};

	const handleRemove = (idx) => {
		const updated = servers.filter((_, serverIdx) => serverIdx !== idx);

		setServers(updated);
		setExpanded((current) => {
			if (updated.length === 1) {
				return [0];
			}

			return current
				.filter((expandedIdx) => expandedIdx !== idx)
				.map((expandedIdx) =>
					expandedIdx > idx ? expandedIdx - 1 : expandedIdx,
				);
		});
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
	if (servers.length == 0 ){
		handleAdd();
	}
	const isExpanded = (idx) => expanded.includes(idx);

	const toggleExpanded = (idx) => {
		setExpanded((current) =>
			current.includes(idx)
				? current.filter((expandedIdx) => expandedIdx !== idx)
				: [...current, idx],
		);
	};

	return (
		<>
			<div className="row">
				<div className="col-md-3 mb-3">
					<Field name="forwardScheme">
						{({ field, form }) => (
							<>
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
							</>
						)}
					</Field>
				</div>
				{servers.length > 1 ? (
					<Field name="npmplusLoadBalanceMethod">
						{({ field, form }) => (
							<>
								<div className="col-md-7">
									<label className="form-label" htmlFor="npmplusLoadBalanceMethod">
										<T id="host.loadbalancer.method" />
										<InfoPopover messageId="host.loadbalancer.method-help" />
									</label>
									<select
										id="npmplusLoadBalanceMethod"
										className="form-select"
										{...field}
										onChange={(e) => handleMethodChange(e.target.value)}
									>
										<option value="round_robin"><T id="host.loadbalancer.round-robin" /></option>
										<option value="least_conn"><T id="host.loadbalancer.least-connections" /></option>
										<option value="ip_hash"><T id="host.loadbalancer.ip-hash" /></option>
									</select>
								</div>
							</>
						)}
					</Field>
				) : null}
			</div>
			{servers.map((server, idx) => (
				<div className={cn(servers.length > 1 && "card card-active p-2 mb-2")}>
					{servers.length > 1 ? (
						<div className={cn("card-header", "p-2", !isExpanded(idx) && "border-bottom-0")}>
							<button
								type="button"
								className="d-flex flex-fill align-self-stretch align-items-center overflow-hidden p-0 text-start text-body bg-transparent border-0"
								aria-expanded={isExpanded(idx)}
								aria-controls={`upstream-host-body-${idx}`}
								onClick={() => toggleExpanded(idx)}
							>
								{isExpanded(idx) ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
								<span className="ms-2 fw-medium text-nowrap">{server.host}</span>								
							</button>
							<button
								type="button"
								className="btn btn-action ms-2"
								title={intl.formatMessage({ id: "action.delete" })}
								aria-label={intl.formatMessage({ id: "action.delete" })}
								onClick={() => handleRemove(idx)}
							>
								<IconTrash size={16} className="icon" />
							</button>
						</div>
					) : null}
					<div 
						className={cn("card-body", !isExpanded(idx) && "d-none")}
						id={`upstream-host-body-${idx}`}
					>
						<div className="row">
							<div className="col-md-6">
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
							{servers.length > 1 ? (
								<>
									<div className="col-md-3">
										<Field name="npmplusUpstreamEnable" type="checkbox">
											{({ field }) => (
												<div className="mb-3">
													<label className="form-label" htmlFor="npmplusUpstreamEnable">
														<T id="enabled" />
													</label>
													<span className="form-check form-check-single form-switch p-0">
														<input
															{...field}
															id="npmplusUpstreamEnable"
															className={cn("form-check-input", {
																"bg-lime": !server.enabled,
															})}
															type="checkbox"
															checked={!server.enabled}
															onChange={(event) =>
																handleChange(idx, "enabled", !event.target.checked)
															}
														/>
													</span>
												</div>
											)}
										</Field>
									</div>
								</>
							) : null}
						</div>
						{servers.length > 1 ? (
							<div className="row">
								<div className="col-md-3">
									<Field name="npmplusUpstreamWeight" validate={validateNumber(-1, 65535)}>
										{({ field, form }) => (
											<div className="mb-3">
												<label className="form-label" htmlFor="npmplusUpstreamWeight">
													<T id="host.upstream.weight" />
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
													<T id="host.upstream.max-fails" />
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
													<T id="host.upstream.timeout" />
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
									<Field name="npmplusUpstreamBackup" type="checkbox">
										{({ field }) => (
											<div className="mb-3">
												<label className="form-label" htmlFor="npmplusUpstreamBackup">
													<T id="host.upstream.backup" />
												</label>
												<span className="form-check form-check-single form-switch p-0">
													<input
														id="npmplusUpstreamBackup"
														className={cn("form-check-input", {
															"bg-lime": server.backup,
														})}
														type="checkbox"
														checked={server.backup}
														disabled={backupDisabled}
														onChange={(event) =>
															handleChange(idx, "backup", event.target.checked)
														}
													/>
												</span>
											</div>
										)}
									</Field>
								</div>
							</div>
						) : null}
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
