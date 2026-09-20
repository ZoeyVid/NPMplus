import cn from "clsx";
import { IconArrowDown, IconArrowUp, IconChevronDown, IconChevronRight, IconInfoCircle, IconTrash, IconX } from "@tabler/icons-react";
import { Field, useFormikContext } from "formik";
import { useState } from "react";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import Popover from "react-bootstrap/Popover";
import Select, { components } from "react-select";
import { flushSync } from "react-dom";
import { intl, T } from "src/locale";
import { validateNumber } from "src/modules/Validations";

const BACKUP_INCOMPATIBLE_METHODS = ["ip_hash", "random", "random_two_least_connections", "random_two_least_time_header", "random_two_least_time_last_byte"];

const NGINX_TIME_SYNTAX_REGEX = "^[1-9]\\d*\\s*(ms|s|m|h|d|w|M|y)?";
const NUMERIC_PATTERN = "[0-9]*";

function InfoPopover({ messageId }) {
	const popover = (
		<Popover>
			<Popover.Body style={{ whiteSpace: "pre-line" }}>{intl.formatMessage({ id: messageId })}</Popover.Body>
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

const numberOrNull = (value) => (value === "" ? null : Number(value));

export function ForwardHostFields({ scheme, loadBalanceMethod, upstreamServers, onChange, loadBalanceMethodFieldName, namePrefix = "" }) {
	const [servers, setServers] = useState(upstreamServers);
	const [method, setMethod] = useState(loadBalanceMethod);
	const [expanded, setExpanded] = useState([0]);
	const { setFieldValue } = useFormikContext();
	const fieldName = (name) => namePrefix ? `${namePrefix}.${name}` : name;

	const blankServer = {
		host: "",
		port: null,
		weight: null,
		maxFails: null,
		failTimeout: "",
		maxConns: "",
		backup: false,
		down: false, // ui is shown as enabled for better UX
	};

	const applyChanges = (changes) => {
		for (const [name, value] of Object.entries(changes)) {
			void setFieldValue(fieldName(name), value);
		}

		onChange?.(changes);
	};

	const syncField = (newServers, newMethod) => {
		// TODO cause a validation failure on blank hosts rather than "silently" remove them
		// const filtered = newServers.filter((s) => s.host.trim() !== "");
		applyChanges({
			npmplusUpstreamServers: newServers,
			npmplusLoadBalanceMethod: newMethod,
		});
	};

	const handleAdd = () => {
		const newServerIdx = servers.length;
		const updated = [...servers, { ...blankServer }];
		setServers(updated);
		setExpanded((current) => [...current, newServerIdx]);
		syncField(updated, method);
	};

	const handleRemove = (idx) => {
		const updated = servers.filter((_, serverIdx) => serverIdx !== idx);
		if(updated.length === 1){
			updated[0] = { ...updated[0], down: false }; // always enable the last server
		}
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

	const handleMove = (idx, newIdx) => {
		// Ordering is used to determine the default port since if upstreams have empty ports, 
		// then the first port is auto applied. Port is required only on the first upstream
		if (newIdx < 0 || newIdx >= servers.length) {
			return;
		}

		const updated = [...servers];
		[updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];

		setServers(updated);
		setExpanded((current) =>
			current.map((expandedIdx) => {
				if (expandedIdx === idx) return newIdx;
				if (expandedIdx === newIdx) return idx;
				return expandedIdx;
			}),
		);
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

	const handleSchemeChange = (newScheme) => {
		const changes = {forwardScheme: newScheme};

		if (newScheme !== "empty") {
			if (!["http", "https"].includes(newScheme)) {
				changes.npmplusProxyRequestBuffering = false;
				changes.npmplusProxyResponseBuffering = false;
			}

			if (newScheme === "path") {
				changes.npmplusUpstreamCompression = false;
			} else {
				changes.npmplusFancyindex = false;
			}
		}

		applyChanges(changes);
	};

	const backupDisabled = BACKUP_INCOMPATIBLE_METHODS.includes(method);
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
									value={scheme}
									onChange={(e) => {handleSchemeChange(e.target.value)}}
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
					<Field name={loadBalanceMethodFieldName}>
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
										value={method}
										onChange={(e) => handleMethodChange(e.target.value)}
									>
										<option value="round_robin"><T id="host.loadbalancer.round-robin" /></option>
										<option value="least_conn"><T id="host.loadbalancer.least-connections" /></option>
										<option value="ip_hash"><T id="host.loadbalancer.ip-hash" /></option>
										<option value="least_time_header"><T id="host.loadbalancer.least-time-header" /></option>
										<option value="least_time_last_byte"><T id="host.loadbalancer.least-time-last-byte" /></option>
										<option value="least_time_last_byte_inflight"><T id="host.loadbalancer.least-time-last-byte-inflight" /></option>
										<option value="random"><T id="host.loadbalancer.random" /></option>
										<option value="random_two_least_connections"><T id="host.loadbalancer.random-two-least-connections" /></option>
										<option value="random_two_least_time_header"><T id="host.loadbalancer.random-two-least-time-header" /></option>
										<option value="random_two_least_time_last_byte"><T id="host.loadbalancer.random-two-least-time-last-byte" /></option>
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
								<span className="ms-2 fw-medium text-nowrap">{server.host}{server.port ?  `:${server.port}`: ""}</span>
							</button>
							{idx > 0 ? (
								<button
									type="button"
									className="btn btn-action ms-2"
									aria-label="Move up"
									onClick={() => handleMove(idx, idx - 1)}
								>
									<IconArrowUp size={16} />
								</button>
							) : null}

							{idx < servers.length - 1 ? (
								<button
									type="button"
									className="btn btn-action ms-2"
									aria-label="Move down"
									onClick={() => handleMove(idx, idx + 1)}
								>
									<IconArrowDown size={16} />
								</button>
							) : null}
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
						onInvalid={() =>
							flushSync(() => {
								setExpanded((current) => 
									current.includes(idx) ? current: [...current, idx],
								);
							})
						}
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
												{...field}
												id="forwardHost"
												type="text"
												required
												className={`form-control ${form.errors.forwardHost && form.touched.forwardHost ? "is-invalid" : ""}`}
												placeholder="example.com"
												value={server.host ?? ""}
												onChange={(event) => handleChange(idx, "host", event.target.value)}
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
												{...field}
												id="forwardPort"
												type="text"
												inputMode="numeric"
												pattern={NUMERIC_PATTERN}
												required={idx === 0}
												className={`form-control ${form.errors.forwardPort && form.touched.forwardPort ? "is-invalid" : ""}`}
												placeholder="eg: 8081"
												value={server.port?? ""}
												onChange={(event) => handleChange(idx, "port", numberOrNull(event.target.value))}
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
														<InfoPopover messageId="host.upstream.enabled-down-help" />
													</label>
													<span className="form-check form-check-single form-switch p-0">
														<input
															{...field}
															id="npmplusUpstreamEnable"
															className={cn("form-check-input", {
																"bg-lime": !server.down, // invert it to represent the UI which shows 'enabled'
															})}
															type="checkbox"
															checked={!Boolean(server.down)}
															onChange={(event) =>handleChange(idx, "down", !event.target.checked)}
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
							<>
								<div className="row">
									<div className="col-md-3">
										<Field name="npmplusUpstreamWeight" validate={validateNumber(-1, 65535)}>
											{({ field, form }) => (
												<div className="mb-3">
													<label className="form-label" htmlFor="npmplusUpstreamWeight">
														<T id="host.upstream.weight" />
													</label>
													<input
														{...field}
														id="npmplusUpstreamWeight"
														type="text"
														inputMode="numeric"
														pattern={NUMERIC_PATTERN}
														className={`form-control ${form.errors.npmplusUpstreamWeight && form.touched.npmplusUpstreamWeight ? "is-invalid" : ""}`}
														placeholder="eg: 1"
														value={server.weight ?? ""}
														onChange={(event) => handleChange(idx, "weight", numberOrNull(event.target.value))}
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
														{...field}
														id="npmplusUpstreamMaxFails"
														type="text"
														inputMode="numeric"
														pattern={NUMERIC_PATTERN}
														className={`form-control ${form.errors.npmplusUpstreamMaxFails && form.touched.npmplusUpstreamMaxFails ? "is-invalid" : ""}`}
														placeholder="eg: 1"
														value={server.maxFails ?? ""}
														onChange={(event) => handleChange(idx, "maxFails", numberOrNull(event.target.value))}
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
										<Field name="npmplusUpstreamTimeout" validate={validateNumber(-1, 65535)}>
											{({ field, form }) => (
												<div className="mb-3">
													<label className="form-label" htmlFor="npmplusUpstreamTimeout">
														<T id="host.upstream.timeout" />
														<InfoPopover messageId="host.upstream.timeout-help" />
													</label>
													<input
														{...field}
														id="npmplusUpstreamTimeout"
														type="text"
														inputMode="numeric"
														pattern={NGINX_TIME_SYNTAX_REGEX}
														className={`form-control ${form.errors.npmplusUpstreamTimeout && form.touched.npmplusUpstreamTimeout ? "is-invalid" : ""}`}
														placeholder="default: 30s"
														value={server.failTimeout ?? ""}
														onChange={(event) => handleChange(idx, "failTimeout", event.target.value)}
													/>

													{form.errors.npmplusUpstreamTimeout ? (
														<div className="invalid-feedback">
															{form.errors.npmplusUpstreamTimeout &&
															form.touched.npmplusUpstreamTimeout
																? form.errors.npmplusUpstreamTimeout
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
															{...field}
															id="npmplusUpstreamBackup"
															className={cn("form-check-input", {
																"bg-lime": server.backup,
															})}
															type="checkbox"
															checked={Boolean(server.backup)}
															disabled={backupDisabled}
															onChange={(event) => handleChange(idx, "backup", event.target.checked)}
														/>
													</span>
												</div>
											)}
										</Field>
									</div>
								</div>
								<div className="row">
									<div className="col-md-4">
										<Field name="npmplusUpstreamMaxConns" validate={validateNumber(-1, 65535)}>
											{({ field, form }) => (
												<div className="mb-3">
													<label className="form-label" htmlFor="npmplusUpstreamMaxConns">
														<T id="host.upstream.max-connections" />
													</label>
													<input
														{...field}
														id="npmplusUpstreamMaxConns"
														type="text"
														inputMode="numeric"
														pattern={NUMERIC_PATTERN}
														className={`form-control ${form.errors.npmplusUpstreamMaxConns && form.touched.npmplusUpstreamMaxConns ? "is-invalid" : ""}`}
														placeholder="eg: 1"
														value={server.maxConns ?? ""}
														onChange={(event) => handleChange(idx, "maxConns", numberOrNull(event.target.value))}
													/>
													{form.errors.npmplusUpstreamMaxConns ? (
														<div className="invalid-feedback">
															{form.errors.npmplusUpstreamMaxConns &&
															form.touched.npmplusUpstreamMaxConns
																? form.errors.npmplusUpstreamMaxConns
																: null}
														</div>
													) : null}
												</div>
											)}
										</Field>
									</div>
								</div>
							</>
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
