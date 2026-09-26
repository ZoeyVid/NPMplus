import cn from "clsx";
import { IconArrowDown, IconArrowUp, IconChevronDown, IconChevronRight, IconInfoCircle, IconTrash } from "@tabler/icons-react";
import { Field, useFormikContext } from "formik";
import { useState } from "react";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import Popover from "react-bootstrap/Popover";
import { flushSync } from "react-dom";
import { intl, T } from "src/locale";
import { validateNumber } from "src/modules/Validations";

const BACKUP_INCOMPATIBLE_METHODS = ["hash", "hash_consistent", "ip_hash", "random", "random_two_least_connections", "random_two_least_time_connect", "random_two_least_time_header", "random_two_least_time_first_byte", "random_two_least_time_last_byte" ];

const NGINX_TIME_SYNTAX_REGEX = "^[1-9]\\d*\\s*(?:ms|s|m|h|d|w|M|y)?$";
const NUMERIC_PATTERN = "^[0-9]*$";
const SERVER_PORT_PATTERN = `${NUMERIC_PATTERN}|\\$server_port`;

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

const numberOrNull = (value, currentValue, allowText = false) => {
	if (value === "" ) { return null; }
	// specifying "$server_port" literal supports only 1 upstream being specified
	if (new RegExp(NUMERIC_PATTERN).test(value)) { return Number(value); }
	return allowText ? value : currentValue;
};

const nginxTimeOrNull = (value, currentValue) => {
	if (value === "" ) { return null; }
	// specifying "$server_port" literal supports only 1 upstream being specified
	if (new RegExp(`${NGINX_TIME_SYNTAX_REGEX}$`).test(value)) { return value; }
	return currentValue;
};

const validatePort = (streams) => (value) => {
	if(value === null || value === "" || (streams && value === "$server_port")) {
		return;
	}
	return validateNumber(1, 65535)(value);
};

const validateNullNumber = (min, max, allowZero) => (value) => {
	if (value === null || value === undefined){
		return;
	}else {
		return validateNumber(min,max, allowZero)(value);
	}
}

const validateTimeout = () => (value) => {
	if(value && !(new RegExp(`${NGINX_TIME_SYNTAX_REGEX}$`).test(value))){
		return intl.formatMessage({ id: "error.nginx-time-format" });
	}
}

export function CleanUpstreamServers(servers = []) {
	return servers.map((server) => {
		const cleaned = { ...server };

		for (const field of ["weight", "maxFails", "maxConns", "failTimeout"]) {
			if (cleaned[field] === null || 
				cleaned[field] === undefined || 
				cleaned[field] === "") {
				delete cleaned[field];
			}
		}
		return cleaned;
	});
}

export function CleanLoadBalanceMethod(object) {
	if (object?.npmplusUpstreamServers?.length === 1){
		delete object.npmplusLoadBalanceMethod;
	}
	return object;
}

export function ForwardHostFields({ scheme="",idPrefix, loadBalanceMethod, upstreamServers, initialForwardPath, onChange, loadBalanceMethodFieldName, namePrefix = "", streams = false }) {
	const [servers, setServers] = useState(upstreamServers);
	const [method, setMethod] = useState(loadBalanceMethod);
	const [forwardPath, setForwardPath] = useState(initialForwardPath);
	const [expanded, setExpanded] = useState([0]);
	const { setFieldValue } = useFormikContext();
	const fieldName = (name) => namePrefix ? `${namePrefix}.${name}` : name;
	const upstreamFieldName = (idx, property) => fieldName(`npmplusUpstreamServers[${idx}].${property}`);
	const controlId = (name, idx) => `${idPrefix}-${name}${idx === undefined ? "" : `-${idx}`}`;
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

	const syncField = (newServers, newMethod, newForwardPath) => {
		applyChanges({
			npmplusUpstreamServers: newServers,
			npmplusLoadBalanceMethod: newMethod,
			npmplusForwardPath: newForwardPath
		});
	};

	const handleAdd = () => {
		const newServerIdx = servers.length;
		const updated = [...servers, { ...blankServer }];
		setServers(updated);
		setExpanded((current) => [...current, newServerIdx]);
		syncField(updated, method, forwardPath);
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
		syncField(updated, method, forwardPath);
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
				if (expandedIdx === idx) { return newIdx; }
				if (expandedIdx === newIdx) { return idx; }
				return expandedIdx;
			}),
		);
		syncField(updated, method, forwardPath);
	};

	const handleChange = (idx, field, value) => {
		const updated = servers.map((s, i) => (i === idx ? { ...s, [field]: value } : s));
		setServers(updated);
		syncField(updated, method, forwardPath);
	};

	const handleMethodChange = (newMethod) => {
		let updated = servers;
		if (BACKUP_INCOMPATIBLE_METHODS.includes(newMethod)) {
			updated = servers.map((s) => ({ ...s, backup: false }));
			setServers(updated);
		}
		setMethod(newMethod);
		syncField(updated, newMethod, forwardPath);
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

	const handleForwardPathChange = (newForwardPath) => {
		setForwardPath(newForwardPath);
		syncField(servers, method, newForwardPath);
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
				{streams ? null : (
					<div className="col-md-3 mb-3">
						<Field name={fieldName("forwardScheme")}>
							{({ field, form }) => (
								<>
									<label
										className="form-label"
										htmlFor={controlId("scheme")}
									>
										<T id="host.forward-scheme" />
									</label>
									<select
										id={controlId("scheme")}
										className="form-select"
										required
										{...field}
										value={scheme}
										onChange={(e) => {handleSchemeChange(e.target.value)}}
									>
										<option value="http">http://</option>
										<option value="https">https://</option>
										<option value="path" disabled={servers.length > 1}>path: </option>
										<option value="empty" disabled={servers.length > 1}>empty</option>
										<option value="grpc">grpc://</option>
										<option value="grpcs">grpcs://</option>
									</select>
								</>
							)}
						</Field>
					</div>
				)}
				{servers.length > 1 ? (
					<Field name={loadBalanceMethodFieldName}>
						{({ field, form }) => (
							<div className="col-md-5 mb-3">
								<label className="form-label" htmlFor={controlId("npmplusLoadBalanceMethod")}>
									<T id="host.loadbalancer.method" />
									<InfoPopover messageId="host.loadbalancer.method-help" />
								</label>
								<select
									id={controlId("npmplusLoadBalanceMethod")}
									className="form-select"
									{...field}
									value={method}
									onChange={(e) => handleMethodChange(e.target.value)}
								>
									<option value="round_robin"><T id="host.loadbalancer.round-robin" /></option>
									<option value="least_conn"><T id="host.loadbalancer.least-connections" /></option>
									{streams ? null : (<option value="ip_hash"><T id={"host.loadbalancer.ip-hash"} /></option>)}
									{streams ? (<option value="hash"><T id={"host.loadbalancer.hash"} /></option>):null}
									{streams ? (<option value="hash_consistent"><T id={"host.loadbalancer.hash-consistent"} /></option>):null}
									{streams ? (<option value="least_time_connect"><T id="host.loadbalancer.least-time-connect"/></option>) : null}
									{streams ? (<option value="least_time_first_byte"><T id="host.loadbalancer.least-time-first-byte"/></option>) : null}
									{streams ? null : (<option value="least_time_header"><T id="host.loadbalancer.least-time-header"/></option>)}
									<option value="least_time_last_byte"><T id="host.loadbalancer.least-time-last-byte" /></option>
									<option value="least_time_last_byte_inflight"><T id="host.loadbalancer.least-time-last-byte-inflight" /></option>
									<option value="random"><T id="host.loadbalancer.random" /></option>
									<option value="random_two_least_connections"><T id="host.loadbalancer.random-two-least-connections" /></option>
									{streams ? (<option value="random_two_least_time_connect"><T id="host.loadbalancer.random-two-least-time-connect"/></option>) : null}
									{streams ? (<option value="random_two_least_time_first_byte"><T id="host.loadbalancer.random-two-least-time-first-byte"/></option>) : null}
									{streams ? null : (<option value="random_two_least_time_header"><T id="host.loadbalancer.random-two-least-time-header"/></option>) }
									<option value="random_two_least_time_last_byte"><T id="host.loadbalancer.random-two-least-time-last-byte" /></option>
								</select>
							</div>
						)}
					</Field>
				) : null}
				{streams ? null : (
					<div className="col-md-4">
						<Field name={fieldName("npmplusForwardPath")} >
							{({ field, meta }) => (
								<div className="mb-3">
									<label className="form-label" htmlFor={controlId("npmplusForwardPath")}>
										<T id={"host.forward-path"} />
									</label>
									<input
										{...field}
										id={controlId("npmplusForwardPath")}
										type="text"
										pattern={"^\\/\\S*"}
										maxLength={255}
										className={`form-control ${meta.touched && meta.error ? "is-invalid" : ""}`}
										placeholder="/example/path"
										value={forwardPath ?? ""}
										onChange={(event) => handleForwardPathChange(event.target.value)}
									/>
									{meta.touched && meta.error ? (
										<div className="invalid-feedback">{meta.error}</div>
									) : null}
								</div>
							)}
						</Field>
					</div>
				)}
			</div>
			{servers.map((server, idx) => {
				const streamValidation = streams && servers.length === 1 && idx === 0;
				return (
					<div key={idx} className={cn(servers.length > 1 && "card card-active p-0 mb-2")}>
						{servers.length > 1 ? (
							<div className={cn("card-header", "p-2", !isExpanded(idx) && "border-bottom-0")}>
								<button
									type="button"
									className="d-flex flex-fill align-self-stretch align-items-center overflow-hidden p-0 text-start text-body bg-transparent border-0"
									aria-expanded={isExpanded(idx)}
									aria-controls={controlId("upstream-body", idx)}
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
							id={controlId("upstream-body", idx)}
							onInvalid={() =>
								flushSync(() => {
									setExpanded((current) =>
										current.includes(idx) ? current: [...current, idx],
									);
								})
							}
						>
							<div className="row m-0">
								<div className="col-md-6">
									<Field 
										name={upstreamFieldName(idx, "host")}
										validate={(value) => {
											if (!value?.trim()) {
												return intl.formatMessage({ id: "error.required" });
											}
										}}
									>
										{({ field, meta }) => (
											<div className="mb-3">
												<label className="form-label" htmlFor={controlId("host", idx)}>
													<T id={streams ? "stream.forward-host": "proxy-host.forward-host-path"} />
												</label>
												<input
													{...field}
													id={controlId("host", idx)}
													type="text"
													required
													className={`form-control ${meta.touched && meta.error ? "is-invalid" : ""}`}
													placeholder={streams ? intl.formatMessage({
																				id: "stream.forward-host.placeholder",
																			}) : "example.com"}
													value={server.host ?? ""}
													onChange={(event) => handleChange(idx, "host", event.target.value)}
												/>
												{meta.touched && meta.error ? (
													<div className="invalid-feedback">{meta.error}</div>
												) : null}
											</div>
										)}
									</Field>
								</div>
								<div className="col-md-3">
									<Field name={upstreamFieldName(idx, "port")} validate={validatePort(streamValidation)}>
										{({ field, meta }) => (
											<div className="mb-3">
												<label className="form-label" htmlFor={controlId("port", idx)}>
													<T id="host.forward-port" />
												</label>
												<input
													{...field}
													id={controlId("port", idx)}
													type="text"
													inputMode={streamValidation ? "text" : "numeric"}
													pattern={streamValidation ? SERVER_PORT_PATTERN : NUMERIC_PATTERN}
													className={`form-control ${meta.touched && meta.error ? "is-invalid" : ""}`}
													placeholder="eg: 8081"
													value={server.port?? ""}
													onChange={(event) => handleChange(idx, "port", numberOrNull(event.target.value, server.port, streamValidation))}
												/>

												{meta.touched && meta.error ? (
													<div className="invalid-feedback">{meta.error}</div>
												) : null}
											</div>
										)}
									</Field>
								</div>
								{servers.length > 1 ? (
									<div className="col-md-3">
										<Field name={upstreamFieldName(idx, "down")} type="checkbox">
											{({ field }) => (
												<div className="mb-3">
													<label className="form-label" htmlFor={controlId("npmplusUpstreamEnable", idx)}>
														<T id="enabled" />
														<InfoPopover messageId="host.upstream.enabled-down-help" />
													</label>
													<span className="form-check form-check-single form-switch p-0">
														<input
															{...field}
															id={controlId("npmplusUpstreamEnable", idx)}
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
								) : null}
							</div>
							{servers.length > 1 ? (
								<>
									<div className="row m-0">
										<div className="col-md-3">
											<Field name={upstreamFieldName(idx, "weight")} validate={validateNullNumber(1, 100)}>
												{({ field, meta }) => (
													<div className="mb-3">
														<label className="form-label" htmlFor={controlId("npmplusUpstreamWeight", idx)}>
															<T id="host.upstream.weight" />
														</label>
														<input
															{...field}
															id={controlId("npmplusUpstreamWeight", idx)}
															type="text"
															inputMode="numeric"
															pattern={NUMERIC_PATTERN}
															className={`form-control ${meta.touched && meta.error ? "is-invalid" : ""}`}
															placeholder="eg: 1"
															value={server.weight ?? ""}
															onChange={(event) => handleChange(idx, "weight", numberOrNull(event.target.value, server.weight))}
														/>

														{meta.touched && meta.error ? (
															<div className="invalid-feedback">{meta.error}</div>
														) : null}
													</div>
												)}
											</Field>
										</div>
										<div className="col-md-3">
											<Field name={upstreamFieldName(idx, "maxFails")} validate={validateNullNumber(0, -1, true)}>
												{({ field, meta }) => (
													<div className="mb-3">
														<label className="form-label" htmlFor={controlId("npmplusUpstreamMaxFails", idx)}>
															<T id="host.upstream.max-fails" />
														</label>
														<input
															{...field}
															id={controlId("npmplusUpstreamMaxFails", idx)}
															type="text"
															inputMode="numeric"
															pattern={NUMERIC_PATTERN}
															className={`form-control ${meta.touched && meta.error ? "is-invalid" : ""}`}
															placeholder="eg: 1"
															value={server.maxFails ?? ""}
															onChange={(event) => handleChange(idx, "maxFails", numberOrNull(event.target.value, server.maxFails))}
														/>

														{meta.touched && meta.error ? (
															<div className="invalid-feedback">{meta.error}</div>
														) : null}
													</div>
												)}
											</Field>
										</div>
										<div className="col-md-3">
											<Field name={upstreamFieldName(idx, "failTimeout")} validate={validateTimeout()}>
												{({ field, meta }) => (
													<div className="mb-3">
														<label className="form-label" htmlFor={controlId("npmplusUpstreamTimeout", idx)}>
															<T id="host.upstream.timeout" />
															<InfoPopover messageId="host.upstream.timeout-help" />
														</label>
														<input
															{...field}
															id={controlId("npmplusUpstreamTimeout", idx)}
															type="text"
															inputMode="text"
															pattern={NGINX_TIME_SYNTAX_REGEX}
															className={`form-control ${meta.touched && meta.error ? "is-invalid" : ""}`}
															placeholder="default: 30s"
															value={server.failTimeout ?? ""}
															onChange={(event) => handleChange(idx, "failTimeout", nginxTimeOrNull(event.target.value, server.failTimeout))}
														/>

														{meta.touched && meta.error ? (
															<div className="invalid-feedback">{meta.error}</div>
														) : null}
													</div>
												)}
											</Field>
										</div>
										<div className="col-md-3">
											<Field name={upstreamFieldName(idx, "backup")} type="checkbox">
												{({ field }) => (
													<div className="mb-3">
														<label className="form-label" htmlFor={controlId("npmplusUpstreamBackup", idx)}>
															<T id="host.upstream.backup" />
														</label>
														<span className="form-check form-check-single form-switch p-0">
															<input
																{...field}
																id={controlId("npmplusUpstreamBackup", idx)}
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
									<div className="row m-0">
										<div className="col-md-4">
											<Field name={upstreamFieldName(idx, "maxConns")} validate={validateNullNumber(0, -1, true)}>
												{({ field, meta }) => (
													<div className="mb-3">
														<label className="form-label" htmlFor={controlId("npmplusUpstreamMaxConns", idx)}>
															<T id="host.upstream.max-connections" />
														</label>
														<input
															{...field}
															id={controlId("npmplusUpstreamMaxConns", idx)}
															type="text"
															inputMode="numeric"
															pattern={NUMERIC_PATTERN}
															className={`form-control ${meta.touched && meta.error ? "is-invalid" : ""}`}
															placeholder="eg: 1"
															value={server.maxConns ?? ""}
															onChange={(event) => handleChange(idx, "maxConns", numberOrNull(event.target.value, server.maxConns))}
														/>
														{meta.touched && meta.error ? (
															<div className="invalid-feedback">{meta.error}</div>
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
				);
			})}

			<div>
				<button
					type="button"
					className="btn btn-sm"
					onClick={handleAdd}
					disabled={
						(!streams && ["path", "empty"].includes(scheme)) ||
						(streams && servers[0]?.port === "$server_port")
					}
				>
					<T id="action.add" />
				</button>
			</div>
		</>
	);
}
