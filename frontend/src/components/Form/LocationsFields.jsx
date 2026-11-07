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
import { Field, FieldArray, useFormikContext } from "formik";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { AccessFields } from "src/components";
import { useUser } from "src/hooks";
import { intl, T } from "src/locale";
import { forwardSummary } from "src/modules/Forward";
import { validateUnixTarget, validateUpstreamUrl } from "src/modules/Validations";

const authProvider = (authRequest) => authRequest?.replace("-send-basic-auth", "");

let nextUiKey = 0;

export const createUiLocation = (item) => ({
	npmplusEnabled: true,
	path: "",
	locationType: "",
	advancedConfig: "",
	forwardScheme: "http",
	forwardHost: "",
	forwardPort: "",
	npmplusAccessListIds: [],
	npmplusNoindex: false,
	npmplusCrowdsecAppsec: false,
	npmplusProxyResponseBuffering: false,
	npmplusProxyRequestBuffering: false,
	npmplusUpstreamCompression: false,
	npmplusFancyindex: false,
	npmplusXFrameOptions: "SAMEORIGIN",
	npmplusAuthRequest: "global",
	npmplusAuthRequestUpstream: "",
	npmplusAccessListType: "global",
	...item,
	uiKey: nextUiKey++,
});

export function LocationsFields({ name = "locations", disabled }) {
	const { data: currentUser } = useUser("me");
	const { values: hostValues, initialValues, setFieldValue } = useFormikContext();
	const values = hostValues[name];
	const [advVisible, setAdvVisible] = useState([]);
	const [expanded, setExpanded] = useState([]);
	const [filter, setFilter] = useState("");
	const scrollToKey = useRef(null);

	const upstreams = {};
	for (const location of values) {
		if (location.npmplusEnabled) {
			const provider = authProvider(location.npmplusAuthRequest);
			upstreams[provider] ??= new Set();
			upstreams[provider].add(location.npmplusAuthRequestUpstream);
		}
	}

	const authRequestUpstreamErrors = values.map((item) => {
		const provider = authProvider(item.npmplusAuthRequest);
		if (!item.npmplusEnabled) return "";
		if (authProvider(hostValues.npmplusAuthRequest) === provider) {
			if (!item.npmplusAuthRequestUpstream) return "";
		} else if (upstreams[provider].size < 2) {
			return "";
		}
		return intl.formatMessage({ id: "proxy-host.location-auth-request-upstream-error" });
	});

	const toggle = (key, list, set) => set(list.includes(key) ? list.filter((i) => i !== key) : [...list, key]);

	const handleAdd = (push) => {
		const item = createUiLocation();
		push(item);
		setExpanded([...expanded, item.uiKey]);
		setFilter("");
		scrollToKey.current = item.uiKey;
	};

	const handleCrowdsecAppsecChange = (e, field, idx) => {
		field.onChange(e);
		if (!e.target.checked) void setFieldValue(`${name}.${idx}.npmplusProxyRequestBuffering`, false);
	};

	const handleAuthRequestChange = (e, field, idx) => {
		field.onChange(e);
		if (["none", "global"].includes(e.target.value)) {
			void setFieldValue(`${name}.${idx}.npmplusAuthRequestUpstream`, "");
		}
	};

	const handleForwardSchemeChange = (e, field, idx) => {
		field.onChange(e);
		const scheme = e.target.value;
		if (scheme === "empty") return;
		if (!["http", "https"].includes(scheme)) {
			void setFieldValue(`${name}.${idx}.npmplusProxyRequestBuffering`, false);
			void setFieldValue(`${name}.${idx}.npmplusProxyResponseBuffering`, false);
		}
		if (scheme === "path") {
			void setFieldValue(`${name}.${idx}.npmplusUpstreamCompression`, false);
		} else {
			void setFieldValue(`${name}.${idx}.npmplusFancyindex`, false);
		}
	};

	const isOpen = (item) => expanded.includes(item.uiKey);

	const locationLabel = (item) => `${item.locationType}${item.path}`;

	const matchesFilter = (item) =>
		`${locationLabel(item)} ${forwardSummary(item)}`.toLowerCase().includes(filter.trim().toLowerCase());

	return (
		<FieldArray name={name} validateOnChange={false}>
			{({ push, remove }) => {
				if (values.length === 0) {
					return (
						<div className="text-center">
							<button
								type="button"
								className="btn my-3"
								onClick={() => handleAdd(push)}
								disabled={disabled}
							>
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
										onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
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
								<button
									type="button"
									className="btn"
									onClick={() => handleAdd(push)}
									disabled={disabled}
								>
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
						{values.map((item, idx) => (
							<div
								key={item.uiKey}
								ref={(node) => {
									if (node && scrollToKey.current === item.uiKey) {
										scrollToKey.current = null;
										node.scrollIntoView({ block: "nearest" });
									}
								}}
								className={cn(
									"card card-active border-light-subtle mb-2",
									!matchesFilter(item) && "d-none",
								)}
							>
								<div
									className={cn(
										"card-header p-2 border-light-subtle",
										!isOpen(item) && "border-bottom-0",
									)}
								>
									<button
										type="button"
										className="d-flex flex-fill align-self-stretch align-items-center overflow-hidden p-0 text-start text-body bg-transparent border-0"
										aria-expanded={isOpen(item)}
										aria-controls={`location-body-${item.uiKey}`}
										onClick={() => toggle(item.uiKey, expanded, setExpanded)}
									>
										{isOpen(item) ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
										<span className="ms-2 fw-medium text-truncate">{locationLabel(item)}</span>
										<span className="ms-2 text-secondary text-truncate">
											{forwardSummary(item)}
										</span>
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
										onClick={() => remove(idx)}
										disabled={disabled}
									>
										<IconTrash size={16} className="icon" />
									</button>
								</div>
								<fieldset
									className={cn("card-body", !isOpen(item) && "d-none")}
									disabled={disabled}
									id={`location-body-${item.uiKey}`}
									onInvalid={() =>
										flushSync(() => {
											setFilter("");
											setExpanded((keys) =>
												keys.includes(item.uiKey) ? keys : [...keys, item.uiKey],
											);
										})
									}
								>
									<div className="row mb-3">
										<label className="row cursor-pointer" htmlFor={`npmplusEnabled-${item.uiKey}`}>
											<span className="col">
												<T id="enabled" />
											</span>
											<span className="col-auto">
												<span className="form-check form-check-single form-switch">
													<Field name={`${name}.${idx}.npmplusEnabled`} type="checkbox">
														{({ field }) => (
															<input
																id={`npmplusEnabled-${item.uiKey}`}
																className={cn("form-check-input", {
																	"bg-lime": item.npmplusEnabled,
																})}
																type="checkbox"
																{...field}
															/>
														)}
													</Field>
												</span>
											</span>
										</label>
									</div>
									<div className="row">
										<div className="col-md-10">
											<div className="input-group mb-3">
												<span className="input-group-text">Location</span>
												<Field name={`${name}.${idx}.locationType`}>
													{({ field }) => (
														<select
															id={`locationType-${item.uiKey}`}
															className="form-select w-auto flex-grow-0"
															{...field}
														>
															<option value="" />
															<option value="@">@</option>
															<option value="= ">=</option>
															<option value="~ ">~</option>
															<option value="~* ">~*</option>
															<option value="^~ ">^~</option>
														</select>
													)}
												</Field>
												<Field name={`${name}.${idx}.path`}>
													{({ field }) => (
														<input
															type="text"
															className="form-control"
															placeholder="/path"
															autoComplete="off"
															required
															pattern="\S{1,255}"
															{...field}
														/>
													)}
												</Field>
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
									{!item.path?.endsWith("/") &&
										(item.locationType === "" || item.locationType === "^~ ") && (
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
												<Field name={`${name}.${idx}.forwardScheme`}>
													{({ field }) => (
														<select
															id={`forwardScheme-${item.uiKey}`}
															className="form-control"
															required
															{...field}
															onChange={(e) => handleForwardSchemeChange(e, field, idx)}
														>
															<option value="http">http://</option>
															<option value="https">https://</option>
															{(currentUser?.npmplusIsAdmin ||
																field.value === "path") && (
																<option value="path">path: </option>
															)}
															<option value="empty">empty</option>
															<option value="grpc">grpc://</option>
															<option value="grpcs">grpcs://</option>
														</select>
													)}
												</Field>
											</div>
										</div>
										<div className="col-md-6">
											<div className="mb-3">
												<label className="form-label" htmlFor={`forwardHost-${item.uiKey}`}>
													<T id="proxy-host.forward-host-path" />
												</label>
												<Field
													name={`${name}.${idx}.forwardHost`}
													validate={(value) =>
														validateUnixTarget(
															value,
															currentUser?.npmplusIsAdmin,
															...initialValues[name].map(
																(location) => location.forwardHost,
															),
														)
													}
												>
													{({ field, meta }) => (
														<>
															<input
																id={`forwardHost-${item.uiKey}`}
																type="text"
																className={`form-control ${meta.touched && meta.error ? "is-invalid" : ""}`}
																required={item.forwardScheme !== "empty"}
																pattern="(?=\S{0,255}$)[^\s\/]{0,253}(\/\S*)?"
																placeholder="eg: 10.0.0.1/path/"
																disabled={
																	!currentUser?.npmplusIsAdmin &&
																	item.forwardScheme === "path"
																}
																{...field}
															/>
															{meta.touched && meta.error && (
																<div className="invalid-feedback">{meta.error}</div>
															)}
														</>
													)}
												</Field>
											</div>
										</div>
										<div className="col-md-3">
											<div className="mb-3">
												<label className="form-label" htmlFor={`forwardPort-${item.uiKey}`}>
													<T id="host.forward-port" />
												</label>
												<Field name={`${name}.${idx}.forwardPort`}>
													{({ field }) => (
														<input
															id={`forwardPort-${item.uiKey}`}
															type="number"
															min={1}
															max={65535}
															className="form-control"
															placeholder="eg: 8081"
															disabled={
																!currentUser?.npmplusIsAdmin &&
																item.forwardScheme === "path"
															}
															{...field}
														/>
													)}
												</Field>
											</div>
										</div>

										<div className="my-3">
											<h4 className="py-2">
												<T id="options" />
											</h4>
											<div className="divide-y">
												<div>
													<label
														className="row cursor-pointer"
														htmlFor={`npmplusNoindex-${item.uiKey}`}
													>
														<span className="col">
															<T id="host.flags.send-noindex" />
														</span>
														<span className="col-auto">
															<span className="form-check form-check-single form-switch">
																<Field
																	name={`${name}.${idx}.npmplusNoindex`}
																	type="checkbox"
																>
																	{({ field }) => (
																		<input
																			id={`npmplusNoindex-${item.uiKey}`}
																			className={cn("form-check-input", {
																				"bg-lime": item.npmplusNoindex,
																			})}
																			type="checkbox"
																			{...field}
																		/>
																	)}
																</Field>
															</span>
														</span>
													</label>
												</div>
												<div>
													<label
														className="row cursor-pointer"
														htmlFor={`npmplusCrowdsecAppsec-${item.uiKey}`}
													>
														<span className="col">
															<T id="host.flags.disable-crowdsec-appsec" />
														</span>
														<span className="col-auto">
															<span className="form-check form-check-single form-switch">
																<Field
																	name={`${name}.${idx}.npmplusCrowdsecAppsec`}
																	type="checkbox"
																>
																	{({ field }) => (
																		<input
																			id={`npmplusCrowdsecAppsec-${item.uiKey}`}
																			className={cn("form-check-input", {
																				"bg-lime": item.npmplusCrowdsecAppsec,
																			})}
																			type="checkbox"
																			{...field}
																			onChange={(e) =>
																				handleCrowdsecAppsecChange(
																					e,
																					field,
																					idx,
																				)
																			}
																		/>
																	)}
																</Field>
															</span>
														</span>
													</label>
												</div>
												<div>
													<label
														className="row cursor-pointer"
														htmlFor={`npmplusProxyRequestBuffering-${item.uiKey}`}
													>
														<span className="col">
															<T id="host.flags.disable-request-buffering" />
														</span>
														<span className="col-auto">
															<span
																className="form-check form-check-single form-switch"
																title={
																	item.npmplusCrowdsecAppsec ||
																	!["http", "https"].includes(item.forwardScheme)
																		? undefined
																		: intl.formatMessage({
																				id: "host.flags.disable-request-buffering.requires-appsec",
																			})
																}
															>
																<Field
																	name={`${name}.${idx}.npmplusProxyRequestBuffering`}
																	type="checkbox"
																>
																	{({ field }) => (
																		<input
																			id={`npmplusProxyRequestBuffering-${item.uiKey}`}
																			className={cn("form-check-input", {
																				"bg-lime":
																					item.npmplusProxyRequestBuffering,
																			})}
																			type="checkbox"
																			{...field}
																			disabled={
																				!item.npmplusCrowdsecAppsec ||
																				!["http", "https"].includes(
																					item.forwardScheme,
																				)
																			}
																		/>
																	)}
																</Field>
															</span>
														</span>
													</label>
												</div>
												<div>
													<label
														className="row cursor-pointer"
														htmlFor={`npmplusProxyResponseBuffering-${item.uiKey}`}
													>
														<span className="col">
															<T id="host.flags.disable-response-buffering" />
														</span>
														<span className="col-auto">
															<span className="form-check form-check-single form-switch">
																<Field
																	name={`${name}.${idx}.npmplusProxyResponseBuffering`}
																	type="checkbox"
																>
																	{({ field }) => (
																		<input
																			id={`npmplusProxyResponseBuffering-${item.uiKey}`}
																			className={cn("form-check-input", {
																				"bg-lime":
																					item.npmplusProxyResponseBuffering,
																			})}
																			type="checkbox"
																			{...field}
																			disabled={
																				!["http", "https"].includes(
																					item.forwardScheme,
																				)
																			}
																		/>
																	)}
																</Field>
															</span>
														</span>
													</label>
												</div>
												<div>
													<label
														className="row cursor-pointer"
														htmlFor={`npmplusUpstreamCompression-${item.uiKey}`}
													>
														<span className="col">
															<T id="host.flags.upstream-compression" />
														</span>
														<span className="col-auto">
															<span className="form-check form-check-single form-switch">
																<Field
																	name={`${name}.${idx}.npmplusUpstreamCompression`}
																	type="checkbox"
																>
																	{({ field }) => (
																		<input
																			id={`npmplusUpstreamCompression-${item.uiKey}`}
																			className={cn("form-check-input", {
																				"bg-lime":
																					item.npmplusUpstreamCompression,
																			})}
																			type="checkbox"
																			{...field}
																			disabled={["path", "empty"].includes(
																				item.forwardScheme,
																			)}
																		/>
																	)}
																</Field>
															</span>
														</span>
													</label>
												</div>
												<div>
													<label
														className="row cursor-pointer"
														htmlFor={`npmplusFancyindex-${item.uiKey}`}
													>
														<span className="col">
															<T id="host.flags.fancyindex" />
														</span>
														<span className="col-auto">
															<span className="form-check form-check-single form-switch">
																<Field
																	name={`${name}.${idx}.npmplusFancyindex`}
																	type="checkbox"
																>
																	{({ field }) => (
																		<input
																			id={`npmplusFancyindex-${item.uiKey}`}
																			className={cn("form-check-input", {
																				"bg-lime": item.npmplusFancyindex,
																			})}
																			type="checkbox"
																			{...field}
																			disabled={item.forwardScheme !== "path"}
																		/>
																	)}
																</Field>
															</span>
														</span>
													</label>
												</div>
												<div>
													<label
														className="row cursor-pointer"
														htmlFor={`npmplusXFrameOptions-${item.uiKey}`}
													>
														<span className="col">X-Frame-Options</span>
														<span className="col-auto">
															<Field name={`${name}.${idx}.npmplusXFrameOptions`}>
																{({ field }) => (
																	<select
																		id={`npmplusXFrameOptions-${item.uiKey}`}
																		className="form-select"
																		required
																		{...field}
																	>
																		<option value="SAMEORIGIN">SAMEORIGIN</option>
																		<option value="DENY">DENY</option>
																		<option value="none">none</option>
																		<option value="upstream">upstream</option>
																	</select>
																)}
															</Field>
														</span>
													</label>
												</div>
												<div>
													<label
														className="row cursor-pointer"
														htmlFor={`npmplusAuthRequest-${item.uiKey}`}
													>
														<span className="col">
															<T id="host.auth-request" />
														</span>
														<span className="col-auto">
															<Field name={`${name}.${idx}.npmplusAuthRequest`}>
																{({ field }) => (
																	<select
																		id={`npmplusAuthRequest-${item.uiKey}`}
																		className="form-select"
																		required
																		{...field}
																		onChange={(e) =>
																			handleAuthRequestChange(e, field, idx)
																		}
																	>
																		<option value="global">global</option>
																		<option value="none">none</option>
																		<option value="anubis">anubis</option>
																		<option value="tinyauth">tinyauth</option>
																		<option value="oauth2proxy">oauth2proxy</option>
																		<option value="voidauth">voidauth</option>
																		<option value="authelia">
																			authelia (modern)
																		</option>
																		<option value="authentik">authentik</option>
																		<option value="authentik-send-basic-auth">
																			authentik-send-basic-auth
																		</option>
																	</select>
																)}
															</Field>
														</span>
													</label>
												</div>
												{!["none", "global"].includes(item.npmplusAuthRequest) && (
													<div>
														<label
															className="row cursor-pointer"
															htmlFor={`npmplusAuthRequestUpstream-${item.uiKey}`}
														>
															<span className="col">
																<T id="host.auth-request-upstream" />
															</span>
															<span className="col-auto">
																<Field
																	name={`${name}.${idx}.npmplusAuthRequestUpstream`}
																	validate={validateUpstreamUrl}
																>
																	{({ field, meta }) => (
																		<>
																			<input
																				id={`npmplusAuthRequestUpstream-${item.uiKey}`}
																				type="text"
																				className={`form-control ${meta.touched && meta.error ? "is-invalid" : ""}`}
																				placeholder={intl.formatMessage({
																					id: "host.auth-request-upstream.placeholder",
																				})}
																				maxLength={255}
																				pattern="^https?://(([^\s\/:]+|\[[a-fA-F0-9:]+\]):[0-9]+|cu_[^\s\/:]+)$"
																				{...field}
																				ref={(input) =>
																					input?.setCustomValidity(
																						authRequestUpstreamErrors[idx],
																					)
																				}
																			/>
																			{meta.touched && meta.error && (
																				<div className="invalid-feedback">
																					{meta.error}
																				</div>
																			)}
																		</>
																	)}
																</Field>
																{authRequestUpstreamErrors[idx] && (
																	<div className="invalid-feedback d-block">
																		{authRequestUpstreamErrors[idx]}
																	</div>
																)}
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
												location={item.path}
												name={`${name}.${idx}.npmplusAccessListIds`}
												typeFieldName={`${name}.${idx}.npmplusAccessListType`}
												disabled={disabled}
												authRequest={item.npmplusAuthRequest.replace(
													"global",
													hostValues.npmplusAuthRequest,
												)}
											/>
										</div>
									</div>
									{(advVisible.includes(item.uiKey) || (disabled && item.advancedConfig?.trim())) && (
										<div className="">
											<Field name={`${name}.${idx}.advancedConfig`}>
												{({ field }) => (
													<textarea
														className="form-control font-monospace"
														spellCheck={false}
														placeholder={intl.formatMessage({
															id: "nginx-config.placeholder",
														})}
														{...field}
														rows={8}
														disabled={!currentUser?.npmplusIsAdmin}
													/>
												)}
											</Field>
										</div>
									)}
								</fieldset>
							</div>
						))}
					</>
				);
			}}
		</FieldArray>
	);
}
