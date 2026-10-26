import { IconSettings } from "@tabler/icons-react";
import cn from "clsx";
import { Field, Form, Formik } from "formik";
import { useState } from "react";
import { Alert } from "react-bootstrap";
import Modal from "react-bootstrap/Modal";
import {
	AccessFields,
	Button,
	DirectoryField,
	DomainNamesField,
	HasPermission,
	Loading,
	LocationsFields,
	NginxConfigField,
	SSLCertificateField,
	SSLOptionsFields,
} from "src/components";
import { useDirectorySuggestions, useProxyHost, useProxyHosts, useSetProxyHost } from "src/hooks";
import { intl, T } from "src/locale";
import EasyModal from "src/modules/easyModal";
import { isHttpForwardScheme } from "src/modules/Forward";
import { MANAGE, PROXY_HOSTS } from "src/modules/Permissions";
import { showTabOfInvalid, validateUpstreamUrl } from "src/modules/Validations";
import { showObjectSuccess } from "src/notifications";
import { CleanLoadBalanceMethod, CleanUpstreamServers, ForwardHostFields } from "../components/Form/ForwardHostFields";

const ProxyHostModal = EasyModal.create(({ id, isClone, visible, remove }) => {
	const { data, isPending, error } = useProxyHost(id);
	const { data: allProxyHosts } = useProxyHosts();
	const suggestions = useDirectorySuggestions(allProxyHosts);
	const { mutate: setProxyHost } = useSetProxyHost();
	const [errorMsg, setErrorMsg] = useState(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [advVisible, setAdvVisible] = useState(false);
	const initialLocations = data?.locations.map(({ id: locationId, proxyHostId, accessLists, ...location }) => ({
		...location,
		npmplusAccessListIds: accessLists?.map((accessList) => accessList.id) ?? location.npmplusAccessListIds ?? [],
	}));

	const onSubmit = (values, { setSubmitting }) => {
		if (isSubmitting) return;
		setIsSubmitting(true);
		setErrorMsg(null);

		// Set the unrestricted acls here (remove any data in their acl lists)
		const globalType = values.npmplusAccessListType;
		let globalAclIds = values.npmplusAccessListIds;
		if (globalType === "public") {
			globalAclIds = [];
		}
		const locations = (values.locations || []).map((loc) => {
			let newLoc = {
				...loc,
				// remove entries that are null or undefined or empty to pass schema validation
				npmplusUpstreamServers: CleanUpstreamServers(loc.npmplusUpstreamServers),
				npmplusAccessListIds: loc.npmplusAccessListType === "custom" ? (loc.npmplusAccessListIds ?? []) : [],
			};
			newLoc = CleanLoadBalanceMethod(newLoc);
			if (!newLoc.npmplusForwardPath) {
				delete newLoc.npmplusForwardPath;
			}
			return newLoc;
		});

		const payload = {
			id: id === "new" || isClone ? undefined : id,
			...values,
			npmplusUpstreamServers: CleanUpstreamServers(values.npmplusUpstreamServers),
			npmplusAccessListIds: globalAclIds,
			locations,
		};
		// Keep payload construction separate from submission cleanup so future cleanup steps remain explicit
		const cleanPayload = CleanLoadBalanceMethod(payload);
		if (!cleanPayload.npmplusForwardPath) {
			if (id === "new" || isClone) {
				delete cleanPayload.npmplusForwardPath;
			} else {
				cleanPayload.npmplusForwardPath = null;
			}
		}
		setProxyHost(cleanPayload, {
			onError: (err) => {
				if (err.payload?.error?.output) {
					setErrorMsg(
						<div className="w-100">
							<pre>
								<code>{err.payload.error.output}</code>
							</pre>
						</div>,
					);
				} else {
					setErrorMsg(<T id={err.message} />);
				}
			},
			onSuccess: () => {
				showObjectSuccess("proxy-host", "saved");
				remove();
			},
			onSettled: () => {
				setIsSubmitting(false);
				setSubmitting(false);
			},
		});
	};

	return (
		<Modal show={visible} onHide={isSubmitting ? undefined : remove}>
			{error && (
				<Alert variant="danger" className="m-3">
					{error?.message}
				</Alert>
			)}
			{isPending && <Loading noLogo />}
			{data && (
				<Formik
					initialValues={{
						// Details tab
						domainNames: data?.domainNames,
						forwardScheme: data?.forwardScheme || "http",
						npmplusLoadBalanceMethod: data?.npmplusLoadBalanceMethod || "round_robin",
						npmplusUpstreamServers: data?.npmplusUpstreamServers?.length
							? data.npmplusUpstreamServers
							: [
									{
										host: "",
										port: null,
										backup: false,
										down: false,
										custom: false,
									},
								],
						npmplusForwardPath: data?.npmplusForwardPath,
						npmplusAccessListIds: data?.accessLists.map((accessList) => accessList.id),
						npmplusAccessListType: data?.npmplusAccessListType,
						// Locations tab
						locations: initialLocations,
						// SSL tab
						certificateId: data?.certificateId,
						sslForced: data?.sslForced,
						npmplusHttp3Support: data?.npmplusHttp3Support,
						hstsEnabled: data?.hstsEnabled,
						hstsSubdomains: data?.hstsSubdomains,
						// Advanced tab
						advancedConfig: data?.advancedConfig,
						npmplusLocationConfig: data?.npmplusLocationConfig,
						npmplusDirectory: data?.npmplusDirectory,
						npmplusMtlsCertificateId: data?.npmplusMtlsCertificateId,
						npmplusMtlsVerifyClientOptional: data?.npmplusMtlsVerifyClientOptional,
						npmplusMtlsBypassAuthRequest: data?.npmplusMtlsBypassAuthRequest,
						npmplusNoindex: data?.npmplusNoindex,
						npmplusCrowdsecAppsec: data?.npmplusCrowdsecAppsec,
						npmplusProxyResponseBuffering: data?.npmplusProxyResponseBuffering,
						npmplusProxyRequestBuffering: data?.npmplusProxyRequestBuffering,
						npmplusUpstreamCompression: data?.npmplusUpstreamCompression,
						npmplusFancyindex: data?.npmplusFancyindex,
						npmplusXFrameOptions: data?.npmplusXFrameOptions,
						npmplusAuthRequest: data?.npmplusAuthRequest,
						npmplusAuthRequestUpstream: data?.npmplusAuthRequestUpstream,
					}}
					onSubmit={onSubmit}
				>
					{({ values }) => (
						<Form onInvalid={showTabOfInvalid}>
							<Modal.Header closeButton={!isSubmitting}>
								<Modal.Title>
									<T
										id={data?.id && !isClone ? "object.edit" : "object.add"}
										tData={{ object: "proxy-host" }}
									/>
								</Modal.Title>
							</Modal.Header>
							<Modal.Body className="p-0">
								<Alert variant="danger" show={errorMsg} onClose={() => setErrorMsg(null)} dismissible>
									{errorMsg}
								</Alert>
								<div className="card m-0 border-0">
									<div className="card-header">
										<ul className="nav nav-tabs card-header-tabs" data-bs-toggle="tabs">
											<li className="nav-item" role="presentation">
												<a
													href="#tab-details"
													className="nav-link active"
													data-bs-toggle="tab"
													aria-selected="true"
													role="tab"
												>
													<T id="column.details" />
												</a>
											</li>
											<li className="nav-item" role="presentation">
												<a
													href="#tab-locations"
													className="nav-link"
													data-bs-toggle="tab"
													aria-selected="false"
													role="tab"
												>
													{<T id="column.custom-locations" />}
													{values?.locations?.length > 0 ? "*" : ""}
												</a>
											</li>
											<li className="nav-item" role="presentation">
												<a
													href="#tab-ssl"
													className="nav-link"
													data-bs-toggle="tab"
													aria-selected="false"
													role="tab"
												>
													<T id="column.ssl" />
												</a>
											</li>
											<li className="nav-item ms-auto" role="presentation">
												<a
													href="#tab-advanced"
													className="nav-link"
													title="Settings"
													data-bs-toggle="tab"
													aria-selected="false"
													role="tab"
												>
													<T id="domains.advanced" />
													{values?.advancedConfig?.trim() ? "*" : ""}
												</a>
											</li>
										</ul>
									</div>
									<div className="card-body">
										<div className="tab-content">
											<div className="tab-pane active show" id="tab-details" role="tabpanel">
												<div className="row">
													<DomainNamesField
														isWildcardPermitted={
															values.certificateId !== "new" || values.npmplusDnsChallenge
														}
														dnsProviderWildcardSupported
														forCertificate={values.certificateId === "new"}
													/>
													<div className="col-md-1 text-end">
														<div className="mb-3">
															<div className="form-label invisible">​</div>
															<button
																type="button"
																className="btn p-0"
																title="LocationConfig"
																onClick={() => setAdvVisible((prev) => !prev)}
															>
																<IconSettings size={20} />
																{values?.npmplusLocationConfig?.trim() ? "*" : ""}
															</button>
														</div>
													</div>
												</div>
												<ForwardHostFields
													idPrefix="proxy-host"
													scheme={values.forwardScheme}
													initialForwardPath={values.npmplusForwardPath}
													loadBalanceMethod={values.npmplusLoadBalanceMethod}
													loadBalanceMethodFieldName="npmplusLoadBalanceMethod"
													upstreamServers={values.npmplusUpstreamServers}
													streams={false}
												/>
												<div className="my-3">
													<h4 className="py-2">
														<T id="options" />
													</h4>
													<div className="divide-y">
														<div>
															<label
																className="row cursor-pointer"
																htmlFor="npmplusNoindex"
															>
																<span className="col">
																	<T id="host.flags.send-noindex" />
																</span>
																<span className="col-auto">
																	<Field name="npmplusNoindex" type="checkbox">
																		{({ field }) => (
																			<span className="form-check form-check-single form-switch">
																				<input
																					{...field}
																					id="npmplusNoindex"
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
														<div>
															<label
																className="row cursor-pointer"
																htmlFor="npmplusCrowdsecAppsec"
															>
																<span className="col">
																	<T id="host.flags.disable-crowdsec-appsec" />
																</span>
																<span className="col-auto">
																	<Field name="npmplusCrowdsecAppsec" type="checkbox">
																		{({ field, form }) => (
																			<span className="form-check form-check-single form-switch">
																				<input
																					{...field}
																					id="npmplusCrowdsecAppsec"
																					className={cn("form-check-input", {
																						"bg-lime": field.checked,
																					})}
																					type="checkbox"
																					onChange={(e) => {
																						field.onChange(e);
																						if (!e.target.checked) {
																							form.setFieldValue(
																								"npmplusProxyRequestBuffering",
																								false,
																							);
																						}
																					}}
																				/>
																			</span>
																		)}
																	</Field>
																</span>
															</label>
														</div>
														<div>
															<label
																className="row cursor-pointer"
																htmlFor="npmplusProxyRequestBuffering"
															>
																<span className="col">
																	<T id="host.flags.disable-request-buffering" />
																</span>
																<span className="col-auto">
																	<Field
																		name="npmplusProxyRequestBuffering"
																		type="checkbox"
																	>
																		{({ field, form }) => (
																			<span
																				className="form-check form-check-single form-switch"
																				title={
																					form.values.npmplusCrowdsecAppsec ||
																					!isHttpForwardScheme(
																						form.values.forwardScheme,
																					)
																						? undefined
																						: intl.formatMessage({
																								id: "host.flags.disable-request-buffering.requires-appsec",
																							})
																				}
																			>
																				<input
																					{...field}
																					id="npmplusProxyRequestBuffering"
																					className={cn("form-check-input", {
																						"bg-lime": field.checked,
																					})}
																					type="checkbox"
																					disabled={
																						!form.values
																							.npmplusCrowdsecAppsec ||
																						!isHttpForwardScheme(
																							form.values.forwardScheme,
																						)
																					}
																				/>
																			</span>
																		)}
																	</Field>
																</span>
															</label>
														</div>
														<div>
															<label
																className="row cursor-pointer"
																htmlFor="npmplusProxyResponseBuffering"
															>
																<span className="col">
																	<T id="host.flags.disable-response-buffering" />
																</span>
																<span className="col-auto">
																	<Field
																		name="npmplusProxyResponseBuffering"
																		type="checkbox"
																	>
																		{({ field, form }) => (
																			<span className="form-check form-check-single form-switch">
																				<input
																					{...field}
																					id="npmplusProxyResponseBuffering"
																					className={cn("form-check-input", {
																						"bg-lime": field.checked,
																					})}
																					type="checkbox"
																					disabled={
																						form.values.forwardScheme !==
																							"http" &&
																						form.values.forwardScheme !==
																							"https"
																					}
																				/>
																			</span>
																		)}
																	</Field>
																</span>
															</label>
														</div>
														<div>
															<label
																className="row cursor-pointer"
																htmlFor="npmplusUpstreamCompression"
															>
																<span className="col">
																	<T id="host.flags.upstream-compression" />
																</span>
																<span className="col-auto">
																	<Field
																		name="npmplusUpstreamCompression"
																		type="checkbox"
																	>
																		{({ field, form }) => (
																			<span className="form-check form-check-single form-switch">
																				<input
																					{...field}
																					id="npmplusUpstreamCompression"
																					className={cn("form-check-input", {
																						"bg-lime": field.checked,
																					})}
																					type="checkbox"
																					disabled={[
																						"path",
																						"empty",
																					].includes(
																						form.values.forwardScheme,
																					)}
																				/>
																			</span>
																		)}
																	</Field>
																</span>
															</label>
														</div>
														<div>
															<label
																className="row cursor-pointer"
																htmlFor="npmplusFancyindex"
															>
																<span className="col">
																	<T id="host.flags.fancyindex" />
																</span>
																<span className="col-auto">
																	<Field name="npmplusFancyindex" type="checkbox">
																		{({ field, form }) => (
																			<span className="form-check form-check-single form-switch">
																				<input
																					{...field}
																					id="npmplusFancyindex"
																					className={cn("form-check-input", {
																						"bg-lime": field.checked,
																					})}
																					type="checkbox"
																					disabled={
																						form.values.forwardScheme !==
																						"path"
																					}
																				/>
																			</span>
																		)}
																	</Field>
																</span>
															</label>
														</div>
														<div>
															<label
																className="row cursor-pointer"
																htmlFor="npmplusXFrameOptions"
															>
																<span className="col">X-Frame-Options</span>
																<span className="col-auto">
																	<Field name="npmplusXFrameOptions">
																		{({ field }) => (
																			<select
																				id="npmplusXFrameOptions"
																				className="form-select"
																				required
																				{...field}
																			>
																				<option value="SAMEORIGIN">
																					SAMEORIGIN
																				</option>
																				<option value="DENY">DENY</option>
																				<option value="none">none</option>
																				<option value="upstream">
																					upstream
																				</option>
																			</select>
																		)}
																	</Field>
																</span>
															</label>
														</div>
														<div>
															<label
																className="row cursor-pointer"
																htmlFor="npmplusAuthRequest"
															>
																<span className="col">
																	<T id="host.auth-request" />
																</span>
																<span className="col-auto">
																	<Field name="npmplusAuthRequest">
																		{({ field, form }) => (
																			<select
																				id="npmplusAuthRequest"
																				className="form-select"
																				required
																				{...field}
																				onChange={(e) => {
																					field.onChange(e);
																					if (e.target.value === "none") {
																						form.setFieldValue(
																							"npmplusAuthRequestUpstream",
																							"",
																						);
																					}
																				}}
																			>
																				<option value="none">none</option>
																				<option value="anubis">anubis</option>
																				<option value="tinyauth">
																					tinyauth
																				</option>
																				<option value="oauth2proxy">
																					oauth2proxy
																				</option>
																				<option value="voidauth">
																					voidauth
																				</option>
																				<option value="authelia">
																					authelia (modern)
																				</option>
																				<option value="authentik">
																					authentik
																				</option>
																				<option value="authentik-send-basic-auth">
																					authentik-send-basic-auth
																				</option>
																			</select>
																		)}
																	</Field>
																</span>
															</label>
														</div>
														{values.npmplusAuthRequest !== "none" && (
															<div>
																<label
																	className="row cursor-pointer"
																	htmlFor="npmplusAuthRequestUpstream"
																>
																	<span className="col">
																		<T id="host.auth-request-upstream" />
																	</span>
																	<span className="col-auto">
																		<Field
																			name="npmplusAuthRequestUpstream"
																			validate={validateUpstreamUrl()}
																		>
																			{({ field, form }) => (
																				<>
																					<input
																						id="npmplusAuthRequestUpstream"
																						type="text"
																						className={`form-control ${form.errors.npmplusAuthRequestUpstream && form.touched.npmplusAuthRequestUpstream ? "is-invalid" : ""}`}
																						placeholder={intl.formatMessage(
																							{
																								id: "host.auth-request-upstream.placeholder",
																							},
																						)}
																						maxLength={255}
																						pattern="^https?://(([^\s\/:]+|\[[a-fA-F0-9:]+\]):[0-9]+|cu_[^\s\/:]+)$"
																						{...field}
																					/>

																					{form.errors
																						.npmplusAuthRequestUpstream ? (
																						<div className="invalid-feedback">
																							{form.touched
																								.npmplusAuthRequestUpstream
																								? form.errors
																										.npmplusAuthRequestUpstream
																								: null}
																						</div>
																					) : null}
																				</>
																			)}
																		</Field>
																	</span>
																</label>
															</div>
														)}
													</div>
												</div>
												<div className="my-3">
													<h4 className="py-2">
														<T id="proxy-host.global-access-lists" />
													</h4>
													<AccessFields
														initialAccessListType={data?.npmplusAccessListType}
														initialAccessListIds={data?.accessLists.map(
															(accessList) => accessList.id,
														)}
														name="npmplusAccessListIds"
														typeFieldName="npmplusAccessListType"
														authRequest={values.npmplusAuthRequest}
													/>
												</div>
												<Field name="npmplusLocationConfig">
													{({ field }) => (
														<>
															{advVisible && (
																<div className="">
																	<textarea
																		className="form-control font-monospace"
																		spellCheck={false}
																		placeholder={intl.formatMessage({
																			id: "nginx-config.placeholder",
																		})}
																		rows={8}
																		{...field}
																	/>
																</div>
															)}
														</>
													)}
												</Field>
											</div>
											<div className="tab-pane" id="tab-locations" role="tabpanel">
												<LocationsFields initialValues={initialLocations} />
											</div>
											<div className="tab-pane" id="tab-ssl" role="tabpanel">
												<SSLCertificateField
													name="certificateId"
													label="ssl-certificate"
													allowNew
												/>

												<SSLOptionsFields color="bg-lime" forProxyHost />
											</div>
											<div className="tab-pane" id="tab-advanced" role="tabpanel">
												<NginxConfigField />
												<div className="row mt-3">
													<div className="col-md-12 mb-3">
														<DirectoryField
															labelId="proxy-host.directory"
															datalistId="directory-suggestions-proxy"
															suggestions={suggestions}
														/>
													</div>
												</div>
											</div>
										</div>
									</div>
								</div>
							</Modal.Body>
							<Modal.Footer>
								<Button onClick={remove} disabled={isSubmitting}>
									<T id="cancel" />
								</Button>
								<HasPermission section={PROXY_HOSTS} permission={MANAGE} hideError>
									<Button
										type="submit"
										color="lime"
										className="ms-auto"
										isLoading={isSubmitting}
										disabled={isSubmitting}
									>
										<T id="save" />
									</Button>
								</HasPermission>
							</Modal.Footer>
						</Form>
					)}
				</Formik>
			)}
		</Modal>
	);
});

const showProxyHostModal = (id, isClone) => {
	EasyModal.show(ProxyHostModal, { id, isClone });
};

export { showProxyHostModal };
