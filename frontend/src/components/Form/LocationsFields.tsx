import {
	IconAlertTriangle,
	IconChevronDown,
	IconChevronRight,
	IconPlus,
	IconSearch,
	IconSettings,
	IconTrash,
	IconX,
} from "@tabler/icons-react";
import cn from "clsx";
import { useFormikContext } from "formik";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { ProxyLocation } from "src/api/backend";
import { AccessFields } from "src/components";
import { intl, T } from "src/locale";
import { upstreamUrlPattern } from "src/modules/Validations";
import styles from "./LocationsFields.module.css";

interface Props {
	initialValues: ProxyLocation[];
	name?: string;
}

// this is needed because React may reindex locations incorrectly,
// so use a controlled index/key to ensure the AccessFields get updated correctly.
// This is because React may reuse the component and associate an AccessField
// with a location that was deleted in the local UI
type UiLocation = ProxyLocation & { uiKey: number };

export function LocationsFields({ initialValues, name = "locations" }: Props) {
	const nextUiKey = useRef(0);
	const createUiLocation = (item: ProxyLocation): UiLocation => ({
		...item,
		uiKey: nextUiKey.current++,
	});

	const [values, setValues] = useState<UiLocation[]>((initialValues || []).map(createUiLocation));
	const { setFieldValue } = useFormikContext();
	const [advVisible, setAdvVisible] = useState<number[]>([]);
	const [expanded, setExpanded] = useState<number[]>([]);
	const [filter, setFilter] = useState("");
	const scrollToKey = useRef<number | null>(null);

	const blankItem: ProxyLocation = {
		npmplusEnabled: true,
		path: "",
		locationType: "",
		advancedConfig: "",
		forwardScheme: "http",
		forwardHost: "",
		forwardPort: "" as any,
		npmplusAccessListIds: [],
		cachingEnabled: false,
		blockExploits: false,
		allowWebsocketUpgrade: true,
		npmplusNoindex: false,
		npmplusCrowdsecAppsec: false,
		npmplusProxyResponseBuffering: false,
		npmplusProxyRequestBuffering: false,
		npmplusUpstreamCompression: false,
		npmplusFancyindex: false,
		npmplusXFrameOptions: "SAMEORIGIN",
		npmplusAuthRequest: "none",
		npmplusAuthRequestUpstream: "",
		npmplusAccessListType: "global",
		id: null,
	};

	const toggle = (key: number, list: number[], set: (value: number[]) => void) =>
		set(list.includes(key) ? list.filter((i) => i !== key) : [...list, key]);

	const handleAdd = () => {
		const item = createUiLocation(blankItem);
		const newValues = [...values, item];
		setValues(newValues);
		setFormField(newValues);
		setExpanded([...expanded, item.uiKey]);
		setFilter("");
		scrollToKey.current = item.uiKey;
	};

	const handleRemove = (idx: number) => {
		const newValues = values.filter((_: UiLocation, i: number) => i !== idx);
		setValues(newValues);
		setFormField(newValues);
	};

	const handleChange = (idx: number, field: string, fieldValue: any) => {
		const newValues = values.map((v: UiLocation, i: number) => {
			if (i !== idx) return v;

			const updatedLocation = { ...v, [field]: fieldValue };

			if (field === "npmplusCrowdsecAppsec" && fieldValue === false) {
				updatedLocation.npmplusProxyRequestBuffering = false;
			}
			if (field === "npmplusProxyRequestBuffering" && fieldValue === true) {
				updatedLocation.npmplusCrowdsecAppsec = true;
			}
			if (field === "forwardScheme" && fieldValue !== "empty") {
				if (!["http", "https"].includes(fieldValue)) {
					updatedLocation.npmplusProxyRequestBuffering = false;
					updatedLocation.npmplusProxyResponseBuffering = false;
				}
				if (fieldValue === "path") {
					updatedLocation.npmplusUpstreamCompression = false;
				} else {
					updatedLocation.npmplusFancyindex = false;
				}
			}
			return updatedLocation;
		});
		setValues(newValues);
		setFormField(newValues);
	};

	const handleAccessFieldsChange = (
		idx: number,
		changes: { npmplusAccessListIds?: number[]; npmplusAccessListType?: ProxyLocation["npmplusAccessListType"] },
	) => {
		const newValues = values.map((val: UiLocation, i: number) => {
			if (i !== idx) {
				return val;
			}
			return { ...val, ...changes };
		});
		setValues(newValues);
		setFormField(newValues);
	};

	const setFormField = (newValues: UiLocation[]) => {
		const filtered = newValues.filter((v: UiLocation) => v?.path?.trim() !== "").map(({ uiKey, ...rest }) => rest);
		void setFieldValue(name, filtered);
	};

	const isOpen = (item: UiLocation) => expanded.includes(item.uiKey);

	const locationLabel = (item: UiLocation) => `${item.locationType ?? ""}${item.path ?? ""}`;

	const forwardSummary = ({ forwardScheme, forwardHost, forwardPort }: UiLocation) => {
		if (!forwardHost || forwardScheme === "empty") return "";
		if (forwardScheme && forwardScheme !== "path") {
			return `${forwardScheme}://${forwardHost}${forwardPort ? `:${forwardPort}` : ""}`;
		}
		return forwardHost;
	};

	const matchesFilter = (item: UiLocation) =>
		`${locationLabel(item)} ${forwardSummary(item)}`.toLowerCase().includes(filter.trim().toLowerCase());

	if (values.length === 0) {
		return (
			<div className="text-center">
				<button type="button" className="btn my-3" onClick={handleAdd}>
					<T id="action.add-location" />
				</button>
			</div>
		);
	}

	return (
		<>
			<div className="row g-2 mb-3">
				<div className="col">
					<div className="input-group">
						<span className="input-group-text">
							<IconSearch size={16} />
						</span>
						<input
							type="text"
							className="form-control"
							autoComplete="off"
							placeholder={intl.formatMessage({ id: "location.filter" })}
							aria-label={intl.formatMessage({ id: "location.filter" })}
							value={filter}
							onChange={(e) => setFilter(e.target.value)}
						/>
						<button
							type="button"
							className="btn btn-icon"
							title={intl.formatMessage({ id: "action.clear" })}
							aria-label={intl.formatMessage({ id: "action.clear" })}
							onClick={() => setFilter("")}
						>
							<IconX size={16} />
						</button>
					</div>
				</div>
				<div className="col-auto">
					<button type="button" className="btn" onClick={handleAdd}>
						<IconPlus size={16} className="me-1" />
						<T id="action.add-location" />
					</button>
				</div>
			</div>
			{!values.some(matchesFilter) && (
				<div className="text-secondary text-center my-3">
					<T id="empty-search" />
				</div>
			)}
			{values.map((item: UiLocation, idx: number) => (
				<div
					key={item.uiKey}
					ref={(node) => {
						if (node && scrollToKey.current === item.uiKey) {
							scrollToKey.current = null;
							node.scrollIntoView({ block: "nearest" });
						}
					}}
					className={cn("card", "card-active", "mb-2", !matchesFilter(item) && "d-none", styles.locationCard)}
				>
					<div className={cn("card-header", "p-2", !isOpen(item) && "border-bottom-0")}>
						<button
							type="button"
							className="d-flex flex-fill align-self-stretch align-items-center overflow-hidden p-0 text-start text-body bg-transparent border-0"
							aria-expanded={isOpen(item)}
							aria-controls={`location-body-${item.uiKey}`}
							onClick={() => toggle(item.uiKey, expanded, setExpanded)}
						>
							{isOpen(item) ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
							<span className="ms-2 fw-medium text-nowrap">{locationLabel(item)}</span>
							<span className="ms-2 text-secondary text-truncate">{forwardSummary(item)}</span>
							{item.advancedConfig?.trim() && (
								<span
									className="ms-2 text-secondary d-flex align-items-center flex-shrink-0"
									role="img"
									title={intl.formatMessage({ id: "nginx-config.label" })}
									aria-label={intl.formatMessage({ id: "nginx-config.label" })}
								>
									<IconSettings size={16} />
								</span>
							)}
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
					<div
						className={cn("card-body", !isOpen(item) && "d-none")}
						id={`location-body-${item.uiKey}`}
						onInvalid={() =>
							flushSync(() => {
								setFilter("");
								setExpanded((keys) => (keys.includes(item.uiKey) ? keys : [...keys, item.uiKey]));
							})
						}
					>
						<div className="row mb-3">
							<label className="row" htmlFor={`npmplusEnabled-${item.uiKey}`}>
								<span className="col">
									<T id="enabled" />
								</span>
								<span className="col-auto">
									<span className="form-check form-check-single form-switch">
										<input
											id={`npmplusEnabled-${item.uiKey}`}
											className={cn("form-check-input", {
												"bg-lime": item.npmplusEnabled !== false,
											})}
											type="checkbox"
											checked={item.npmplusEnabled !== false}
											onChange={(e) => handleChange(idx, "npmplusEnabled", e.target.checked)}
										/>
									</span>
								</span>
							</label>
						</div>
						<div className="row">
							<div className="col-md-10">
								<div className="input-group mb-3">
									<span className="input-group-text">Location</span>
									<select
										id={`locationType-${item.uiKey}`}
										className="form-select w-auto flex-grow-0"
										value={item.locationType}
										onChange={(e) => handleChange(idx, "locationType", e.target.value)}
									>
										<option value="" />
										<option value="@">@</option>
										<option value="= ">=</option>
										<option value="~ ">~</option>
										<option value="~* ">~*</option>
										<option value="^~ ">^~</option>
									</select>
									<input
										type="text"
										className="form-control"
										placeholder="/path"
										autoComplete="off"
										value={item.path}
										onChange={(e) => handleChange(idx, "path", e.target.value)}
									/>
								</div>
							</div>
							<div className="col-md-2 text-end">
								<button
									type="button"
									className="btn p-0"
									title="Advanced"
									onClick={() => toggle(item.uiKey, advVisible, setAdvVisible)}
								>
									<IconSettings size={20} />
									{item?.advancedConfig?.trim() ? "*" : ""}
								</button>
							</div>
						</div>
						{!item.path?.endsWith("/") && (item.locationType === "" || item.locationType === "^~ ") && (
							<p className="text-warning">
								<IconAlertTriangle size={16} className="me-1" />
								<T id="proxy-host.location-no-trailing-slash-warning" />
							</p>
						)}
						<div className="row">
							<div className="col-md-3">
								<div className="mb-3">
									<label className="form-label" htmlFor={`forwardScheme-${item.uiKey}`}>
										<T id="host.forward-scheme" />
									</label>
									<select
										id={`forwardScheme-${item.uiKey}`}
										className="form-control"
										value={item.forwardScheme}
										onChange={(e) => handleChange(idx, "forwardScheme", e.target.value)}
									>
										<option value="http">http://</option>
										<option value="https">https://</option>
										<option value="path">path: </option>
										<option value="empty">empty</option>
										<option value="grpc">grpc://</option>
										<option value="grpcs">grpcs://</option>
									</select>
								</div>
							</div>
							<div className="col-md-6">
								<div className="mb-3">
									<label className="form-label" htmlFor={`forwardHost-${item.uiKey}`}>
										<T id="proxy-host.forward-host-path" />
									</label>
									<input
										id={`forwardHost-${item.uiKey}`}
										type="text"
										className="form-control"
										required={item.forwardScheme !== "empty"}
										placeholder="eg: 10.0.0.1/path/"
										value={item.forwardHost}
										onChange={(e) => handleChange(idx, "forwardHost", e.target.value)}
									/>
								</div>
							</div>
							<div className="col-md-3">
								<div className="mb-3">
									<label className="form-label" htmlFor={`forwardPort-${item.uiKey}`}>
										<T id="host.forward-port" />
									</label>
									<input
										id={`forwardPort-${item.uiKey}`}
										type="number"
										min={1}
										max={65535}
										className="form-control"
										placeholder="eg: 8081"
										value={item.forwardPort}
										onChange={(e) => handleChange(idx, "forwardPort", e.target.value)}
									/>
								</div>
							</div>

							<div className="my-3">
								<h4 className="py-2">
									<T id="options" />
								</h4>
								<div className="divide-y">
									<div>
										<label className="row" htmlFor={`npmplusNoindex-${item.uiKey}`}>
											<span className="col">
												<T id="host.flags.send-noindex" />
											</span>
											<span className="col-auto">
												<span className="form-check form-check-single form-switch">
													<input
														id={`npmplusNoindex-${item.uiKey}`}
														className={cn("form-check-input", {
															"bg-lime": item.npmplusNoindex,
														})}
														type="checkbox"
														checked={item.npmplusNoindex}
														onChange={(e) =>
															handleChange(idx, "npmplusNoindex", e.target.checked)
														}
													/>
												</span>
											</span>
										</label>
									</div>
									<div>
										<label className="row" htmlFor={`npmplusCrowdsecAppsec-${item.uiKey}`}>
											<span className="col">
												<T id="host.flags.disable-crowdsec-appsec" />
											</span>
											<span className="col-auto">
												<span className="form-check form-check-single form-switch">
													<input
														id={`npmplusCrowdsecAppsec-${item.uiKey}`}
														className={cn("form-check-input", {
															"bg-lime": item.npmplusCrowdsecAppsec,
														})}
														type="checkbox"
														checked={item.npmplusCrowdsecAppsec}
														onChange={(e) =>
															handleChange(idx, "npmplusCrowdsecAppsec", e.target.checked)
														}
													/>
												</span>
											</span>
										</label>
									</div>
									<div>
										<label className="row" htmlFor={`npmplusProxyRequestBuffering-${item.uiKey}`}>
											<span className="col">
												<T id="host.flags.disable-request-buffering" />
											</span>
											<span className="col-auto">
												<span className="form-check form-check-single form-switch">
													<input
														id={`npmplusProxyRequestBuffering-${item.uiKey}`}
														className={cn("form-check-input", {
															"bg-lime": item.npmplusProxyRequestBuffering,
														})}
														type="checkbox"
														checked={item.npmplusProxyRequestBuffering}
														onChange={(e) =>
															handleChange(
																idx,
																"npmplusProxyRequestBuffering",
																e.target.checked,
															)
														}
														disabled={!["http", "https"].includes(item.forwardScheme)}
													/>
												</span>
											</span>
										</label>
									</div>
									<div>
										<label className="row" htmlFor={`npmplusProxyResponseBuffering-${item.uiKey}`}>
											<span className="col">
												<T id="host.flags.disable-response-buffering" />
											</span>
											<span className="col-auto">
												<span className="form-check form-check-single form-switch">
													<input
														id={`npmplusProxyResponseBuffering-${item.uiKey}`}
														className={cn("form-check-input", {
															"bg-lime": item.npmplusProxyResponseBuffering,
														})}
														type="checkbox"
														checked={item.npmplusProxyResponseBuffering}
														onChange={(e) =>
															handleChange(
																idx,
																"npmplusProxyResponseBuffering",
																e.target.checked,
															)
														}
														disabled={!["http", "https"].includes(item.forwardScheme)}
													/>
												</span>
											</span>
										</label>
									</div>
									<div>
										<label className="row" htmlFor={`npmplusUpstreamCompression-${item.uiKey}`}>
											<span className="col">
												<T id="host.flags.upstream-compression" />
											</span>
											<span className="col-auto">
												<span className="form-check form-check-single form-switch">
													<input
														id={`npmplusUpstreamCompression-${item.uiKey}`}
														className={cn("form-check-input", {
															"bg-lime": item.npmplusUpstreamCompression,
														})}
														type="checkbox"
														checked={item.npmplusUpstreamCompression}
														onChange={(e) =>
															handleChange(
																idx,
																"npmplusUpstreamCompression",
																e.target.checked,
															)
														}
														disabled={["path", "empty"].includes(item.forwardScheme)}
													/>
												</span>
											</span>
										</label>
									</div>
									<div>
										<label className="row" htmlFor={`npmplusFancyindex-${item.uiKey}`}>
											<span className="col">
												<T id="host.flags.fancyindex" />
											</span>
											<span className="col-auto">
												<span className="form-check form-check-single form-switch">
													<input
														id={`npmplusFancyindex-${item.uiKey}`}
														className={cn("form-check-input", {
															"bg-lime": item.npmplusFancyindex,
														})}
														type="checkbox"
														checked={item.npmplusFancyindex}
														onChange={(e) =>
															handleChange(idx, "npmplusFancyindex", e.target.checked)
														}
														disabled={item.forwardScheme !== "path"}
													/>
												</span>
											</span>
										</label>
									</div>
									<div>
										<label className="row" htmlFor={`npmplusXFrameOptions-${item.uiKey}`}>
											<span className="col">X-Frame-Options</span>
											<span className="col-auto">
												<select
													id={`npmplusXFrameOptions-${item.uiKey}`}
													className="form-select"
													value={item.npmplusXFrameOptions}
													onChange={(e) =>
														handleChange(idx, "npmplusXFrameOptions", e.target.value)
													}
												>
													<option value="SAMEORIGIN">SAMEORIGIN</option>
													<option value="DENY">DENY</option>
													<option value="none">none</option>
													<option value="upstream">upstream</option>
												</select>
											</span>
										</label>
									</div>
									<div>
										<label className="row" htmlFor={`npmplusAuthRequest-${item.uiKey}`}>
											<span className="col">
												<T id="host.auth-request" />
											</span>
											<span className="col-auto">
												<select
													id={`npmplusAuthRequest-${item.uiKey}`}
													className="form-select"
													value={item.npmplusAuthRequest}
													onChange={(e) =>
														handleChange(idx, "npmplusAuthRequest", e.target.value)
													}
												>
													<option value="none">none</option>
													<option value="anubis">anubis</option>
													<option value="tinyauth">tinyauth</option>
													<option value="oauth2proxy">oauth2proxy</option>
													<option value="voidauth">voidauth</option>
													<option value="authelia">authelia (modern)</option>
													<option value="authentik">authentik</option>
													<option value="authentik-send-basic-auth">
														authentik-send-basic-auth
													</option>
												</select>
											</span>
										</label>
									</div>
									{item?.npmplusAuthRequest?.length > 0 && item.npmplusAuthRequest !== "none" && (
										<div>
											<label className="row" htmlFor={`npmplusAuthRequestUpstream-${item.uiKey}`}>
												<span className="col">
													<T id="host.auth-request-upstream" />
												</span>
												<span className="col-auto">
													<input
														id={`npmplusAuthRequestUpstream-${item.uiKey}`}
														type="text"
														className={`form-control ${item.npmplusAuthRequestUpstream && !upstreamUrlPattern.test(item.npmplusAuthRequestUpstream) ? "is-invalid" : ""}`}
														placeholder="keep empty to reuse env value"
														pattern="^https?://([^/:]+|\[[a-fA-F0-9:]+\]):[0-9]+$"
														value={item.npmplusAuthRequestUpstream || ""}
														onChange={(e) =>
															handleChange(
																idx,
																"npmplusAuthRequestUpstream",
																e.target.value,
															)
														}
													/>
													{item.npmplusAuthRequestUpstream &&
													!upstreamUrlPattern.test(item.npmplusAuthRequestUpstream) ? (
														<div className="invalid-feedback">
															<T id="error.invalid-upstream-url" />
														</div>
													) : null}
												</span>
											</label>
										</div>
									)}
								</div>
							</div>
							<div className="my-3">
								<h4 className="py-2">
									<T id="proxy-host.access-lists" />
								</h4>
								<AccessFields
									initialAccessListType={item?.npmplusAccessListType || "global"}
									location={item.path}
									initialAccessListIds={item?.npmplusAccessListIds || []}
									name={`locations[${idx}].npmplusAccessListIds`}
									typeFieldName={`locations[${idx}].npmplusAccessListType`}
									onChange={(changes) => handleAccessFieldsChange(idx, changes)}
								/>
							</div>
						</div>
						{advVisible.includes(item.uiKey) && (
							<div className="">
								<textarea
									className="form-control"
									spellCheck={false}
									placeholder={intl.formatMessage({ id: "nginx-config.placeholder" })}
									value={item.advancedConfig}
									onChange={(e) => handleChange(idx, "advancedConfig", e.target.value)}
									style={{
										fontFamily:
											"ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace",
										borderRadius: "0.3rem",
										minHeight: "170px",
									}}
								/>
							</div>
						)}
					</div>
				</div>
			))}
		</>
	);
}
