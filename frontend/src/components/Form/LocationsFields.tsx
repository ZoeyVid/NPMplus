import { IconSettings } from "@tabler/icons-react";
import CodeEditor from "@uiw/react-textarea-code-editor";
import cn from "classnames";
import { useFormikContext } from "formik";
import { useRef, useState } from "react";
import type { ProxyLocation } from "src/api/backend";
import { AccessFields } from "src/components";
import { intl, T } from "src/locale";
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
		npmplusDisableUriSanitisation: false,
		npmplusSpoofHostHeader: false,
		npmplusUpstreamCompression: false,
		npmplusFancyindex: false,
		npmplusXFrameOptions: "SAMEORIGIN",
		npmplusAuthRequest: "none",
		npmplusAuthRequestUpstream: "",
		npmplusAccessListType: "global",
		id: null,
	};

	const toggleAdvVisible = (idx: number) => {
		setAdvVisible(advVisible.includes(idx) ? advVisible.filter((i) => i !== idx) : [...advVisible, idx]);
	};

	const handleAdd = () => {
		const newValues = [...values, createUiLocation(blankItem)];
		setValues(newValues);
		setFormField(newValues);
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
			if (field === "forwardHost" && fieldValue.includes("/")) {
				updatedLocation.npmplusDisableUriSanitisation = false;
			}
			if (field === "forwardScheme" && fieldValue !== "empty") {
				if (!["http", "https"].includes(fieldValue)) {
					updatedLocation.npmplusProxyRequestBuffering = false;
					updatedLocation.npmplusProxyResponseBuffering = false;
				}
				if (fieldValue === "path") {
					updatedLocation.npmplusUpstreamCompression = false;
					updatedLocation.npmplusDisableUriSanitisation = false;
					updatedLocation.npmplusSpoofHostHeader = false;
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
		setFieldValue(name, filtered);
	};

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
			{values.map((item: UiLocation, idx: number) => (
				<div key={item.uiKey} className={cn("card", "card-active", "mb-3", styles.locationCard)}>
					<div className="card-body">
						<div className="row mb-3">
							<label className="row" htmlFor={`npmplusEnabled-${item.uiKey}`}>
								<span className="col">
									<T id="enabled" />
								</span>
								<span className="col-auto">
									<label className="form-check form-check-single form-switch">
										<input
											id={`npmplusEnabled-${item.uiKey}`}
											className={cn("form-check-input", {
												"bg-lime": item.npmplusEnabled !== false,
											})}
											type="checkbox"
											checked={item.npmplusEnabled !== false}
											onChange={(e) => handleChange(idx, "npmplusEnabled", e.target.checked)}
										/>
									</label>
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
									onClick={() => toggleAdvVisible(idx)}
								>
									<IconSettings size={20} />
									{item?.advancedConfig?.trim() ? "*" : ""}
								</button>
							</div>
						</div>
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
									<T id="proxy-host.access-lists" />
								</h4>
								<AccessFields
									initialAccessListType={item?.npmplusAccessListType || "global"}
									location={item.path}
									initialAccessListIds={item?.npmplusAccessListIds || []}
									name={`locations[${idx}].npmplusAccessListIds`}
									type={`locations[${idx}].npmplusAccessListType`}
									onChange={(changes) => handleAccessFieldsChange(idx, changes)}
								/>
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
												<label className="form-check form-check-single form-switch">
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
												</label>
											</span>
										</label>
									</div>
									<div>
										<label className="row" htmlFor={`npmplusCrowdsecAppsec-${item.uiKey}`}>
											<span className="col">
												<T id="host.flags.disable-crowdsec-appsec" />
											</span>
											<span className="col-auto">
												<label className="form-check form-check-single form-switch">
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
												</label>
											</span>
										</label>
									</div>
									<div>
										<label className="row" htmlFor={`npmplusProxyRequestBuffering-${item.uiKey}`}>
											<span className="col">
												<T id="host.flags.disable-request-buffering" />
											</span>
											<span className="col-auto">
												<label className="form-check form-check-single form-switch">
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
												</label>
											</span>
										</label>
									</div>
									<div>
										<label className="row" htmlFor={`npmplusProxyResponseBuffering-${item.uiKey}`}>
											<span className="col">
												<T id="host.flags.disable-response-buffering" />
											</span>
											<span className="col-auto">
												<label className="form-check form-check-single form-switch">
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
												</label>
											</span>
										</label>
									</div>
									<div>
										<label className="row" htmlFor={`npmplusUpstreamCompression-${item.uiKey}`}>
											<span className="col">
												<T id="host.flags.upstream-compression" />
											</span>
											<span className="col-auto">
												<label className="form-check form-check-single form-switch">
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
												</label>
											</span>
										</label>
									</div>
									<div>
										<label className="row" htmlFor={`npmplusDisableUriSanitisation-${item.uiKey}`}>
											<span className="col">
												<T id="host.flags.disable-uri-sanitisation" />
											</span>
											<span className="col-auto">
												<label className="form-check form-check-single form-switch">
													<input
														id={`npmplusDisableUriSanitisation-${item.uiKey}`}
														className={cn("form-check-input", {
															"bg-lime": item.npmplusDisableUriSanitisation,
														})}
														type="checkbox"
														checked={item.npmplusDisableUriSanitisation}
														onChange={(e) =>
															handleChange(
																idx,
																"npmplusDisableUriSanitisation",
																e.target.checked,
															)
														}
														disabled={
															!["http", "https", "grpc", "grpcs"].includes(
																item.forwardScheme,
															) || (item.forwardHost || "").includes("/")
														}
													/>
												</label>
											</span>
										</label>
									</div>
									<div>
										<label className="row" htmlFor={`npmplusSpoofHostHeader-${item.uiKey}`}>
											<span className="col">
												<T id="host.flags.spoof-host-header" />
											</span>
											<span className="col-auto">
												<label className="form-check form-check-single form-switch">
													<input
														id={`npmplusSpoofHostHeader-${item.uiKey}`}
														className={cn("form-check-input", {
															"bg-lime": item.npmplusSpoofHostHeader,
														})}
														type="checkbox"
														checked={item.npmplusSpoofHostHeader}
														onChange={(e) =>
															handleChange(
																idx,
																"npmplusSpoofHostHeader",
																e.target.checked,
															)
														}
														disabled={
															!["http", "https", "grpc", "grpcs"].includes(
																item.forwardScheme,
															)
														}
													/>
												</label>
											</span>
										</label>
									</div>
									<div>
										<label className="row" htmlFor={`npmplusFancyindex-${item.uiKey}`}>
											<span className="col">
												<T id="host.flags.fancyindex" />
											</span>
											<span className="col-auto">
												<label className="form-check form-check-single form-switch">
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
												</label>
											</span>
										</label>
									</div>
									<div>
										<label className="row" htmlFor={`npmplusXFrameOptions-${item.uiKey}`}>
											<span className="col">X-Frame-Options</span>
											<span className="col-auto">
												<label className="form-check form-check-single form-switch">
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
												</label>
											</span>
										</label>
									</div>
									<div>
										<label className="row" htmlFor={`npmplusAuthRequest-${item.uiKey}`}>
											<span className="col">
												<T id="host.auth-request" />
											</span>
											<span className="col-auto">
												<label className="form-check form-check-single form-switch">
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
												</label>
											</span>
										</label>
									</div>
									{item.npmplusAuthRequest !== "none" && (
										<div>
											<label className="row" htmlFor={`npmplusAuthRequestUpstream-${item.uiKey}`}>
												<span className="col">
													<T id="host.auth-request-upstream" />
												</span>
												<span className="col-auto">
													<input
														id={`npmplusAuthRequestUpstream-${item.uiKey}`}
														type="text"
														className={`form-control ${item.npmplusAuthRequestUpstream && !/^https?:\/\/([^/:]+|\[[a-fA-F0-9:]+\]):[0-9]+$/.test(item.npmplusAuthRequestUpstream) ? "is-invalid" : ""}`}
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
													!/^https?:\/\/([^/:]+|\[[a-fA-F0-9:]+\]):[0-9]+$/.test(
														item.npmplusAuthRequestUpstream,
													) ? (
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
						</div>
						{advVisible.includes(idx) && (
							<div className="">
								<CodeEditor
									language="nginx"
									placeholder={intl.formatMessage({ id: "nginx-config.placeholder" })}
									padding={15}
									data-color-mode="dark"
									minHeight={170}
									indentWidth={2}
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
						<div className="mt-1">
							<a
								href="#"
								onClick={(e) => {
									e.preventDefault();
									handleRemove(idx);
								}}
							>
								<T id="action.delete" />
							</a>
						</div>
					</div>
				</div>
			))}
			<div>
				<button type="button" className="btn btn-sm" onClick={handleAdd}>
					<T id="action.add-location" />
				</button>
			</div>
		</>
	);
}
