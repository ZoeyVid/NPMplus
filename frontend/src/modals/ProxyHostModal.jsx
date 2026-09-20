import { IconSettings } from "@tabler/icons-react";
import cn from "clsx";
import { ErrorMessage, Field, Form, Formik } from "formik";
import { useMemo, useState } from "react";
import { Alert } from "react-bootstrap";
import Modal from "react-bootstrap/Modal";
import {
	AccessFields,
	Button,
	CommandOutput,
	createUiLocation,
	DirectoryField,
	DomainNamesField,
	Loading,
	LocationsFields,
	NginxConfigField,
	SSLCertificateField,
	SSLOptionsFields,
} from "src/components";
import { useDirectorySuggestions, useProxyHost, useProxyHosts, useSetProxyHost, useUser } from "src/hooks";
import { intl, T } from "src/locale";
import EasyModal from "src/modules/easyModal";
import { hasPermission, MANAGE, PROXY_HOSTS } from "src/modules/Permissions";
import { showTabOfInvalid, validateUpstreamUrl } from "src/modules/Validations";
import { showObjectSuccess } from "src/notifications";
import { ForwardHostFields } from "../components/Form/ForwardHostFields";

const requestBufferingTitle = ({ npmplusDisableCrowdsecAppsec, forwardScheme }) => {
	if (!npmplusDisableCrowdsecAppsec && ["http", "https"].includes(forwardScheme)) {
		return intl.formatMessage({ id: "host.flags.disable-request-buffering.requires-appsec" });
	}
	return null;
};

const ProxyHostModal = EasyModal.create(({ id, isClone, visible, remove, close, formRef }) => {
	const { data, isPending, error } = useProxyHost(id);
	const { data: allProxyHosts } = useProxyHosts();
	const suggestions = useDirectorySuggestions(allProxyHosts);
	const { mutateAsync: setProxyHost } = useSetProxyHost();
	const { data: currentUser } = useUser("me");
	const canManage = hasPermission(PROXY_HOSTS, MANAGE, currentUser?.permissions, currentUser?.npmplusIsAdmin);
	const [errorMsg, setErrorMsg] = useState(null);
	const [advVisible, setAdvVisible] = useState(false);

	const stripAdminConfig = isClone && !currentUser?.npmplusIsAdmin;
	const initialValues = useMemo(
		() => ({
			// Details tab
			domainNames: isClone ? [] : data?.domainNames,
			forwardScheme: data?.forwardScheme || "http",
			npmplusLoadBalanceMethod: data?.npmplusLoadBalanceMethod || "round_robin",
			npmplusUpstreamServers: data?.npmplusUpstreamServers?.length
				? data.npmplusUpstreamServers
				: [
						{
							host: data?.forwardHost || "",
							port: data?.forwardPort ?? null,
							weight: 1,
							maxFails: 1,
							failTimeout: 10,
							backup: false,
							enabled: true,
						},
					],
			npmplusAccessListIds: data?.accessLists.map((accessList) => accessList.id),
			npmplusAccessListType: data?.npmplusAccessListType,
			// Locations tab
			locations: data?.locations.map(({ id: locationId, proxyHostId, accessLists, ...location }) =>
				createUiLocation({
					...location,
					forwardPort: location.forwardPort || "",
					advancedConfig: stripAdminConfig ? "" : location.advancedConfig,
					npmplusAccessListIds: accessLists.map((accessList) => accessList.id),
				}),
			),
			// SSL tab
			certificateId: data?.certificateId,
			sslForced: data?.sslForced,
			npmplusHttp3Support: data?.npmplusHttp3Support,
			hstsEnabled: data?.hstsEnabled,
			hstsSubdomains: data?.hstsSubdomains,
			// Advanced tab
			advancedConfig: stripAdminConfig ? "" : data?.advancedConfig,
			npmplusLocationConfig: stripAdminConfig ? "" : data?.npmplusLocationConfig,
			npmplusDirectory: data?.npmplusDirectory,
			npmplusMtlsCertificateId: data?.npmplusMtlsCertificateId,
			npmplusMtlsVerifyClientOptional: data?.npmplusMtlsVerifyClientOptional,
			npmplusMtlsBypassAuthRequest: data?.npmplusMtlsBypassAuthRequest,
			npmplusNoindex: data?.npmplusNoindex,
			npmplusDisableCrowdsecAppsec: data?.npmplusDisableCrowdsecAppsec,
			npmplusProxyResponseBuffering: data?.npmplusProxyResponseBuffering,
			npmplusDisableProxyRequestBuffering: data?.npmplusDisableProxyRequestBuffering,
			npmplusUpstreamCompression: data?.npmplusUpstreamCompression,
			npmplusFancyindex: data?.npmplusFancyindex,
			npmplusXFrameOptions: data?.npmplusXFrameOptions,
			npmplusAuthRequest: data?.npmplusAuthRequest,
			npmplusAuthRequestUpstream: data?.npmplusAuthRequestUpstream,
		}),
		[data, isClone, stripAdminConfig],
	);

	const onSubmit = async (values, { setFieldValue }) => {
		setErrorMsg(null);

		// remove entries that are null or undefined or empty to pass schema validation
		const cleanUpstreamServers = (servers = []) =>
			servers.map((server) => {
			const cleaned = { ...server };

			for (const field of ["weight", "maxFails", "maxConns", "failTimeout"]) {
				if (cleaned[field] === null || cleaned[field] === undefined || cleaned[field] === "") {
					delete cleaned[field];
				}
			}

			return cleaned;
		});

		// Set the unrestricted acls here (remove any data in their acl lists)
		const globalType = values.npmplusAccessListType;
		let globalAclIds = values.npmplusAccessListIds;
		if (globalType === "public") {
			globalAclIds = [];
		}
		const locations = (values.locations || [])
			.filter((location) => location.path.trim()).map((uiKey, loc) => {
			const newLoc = { 
				...loc, 
				npmplusUpstreamServers: cleanUpstreamServers(
					loc.npmplusUpstreamServers,
				),
				npmplusAccessListIds:
					location.npmplusAccessListType === "custom" ? location.npmplusAccessListIds : [],
			};
			return newLoc;
		});

		const payload = {
			id: id === "new" || isClone ? undefined : id,
			...values,
			npmplusUpstreamServers: cleanUpstreamServers(
				values.npmplusUpstreamServers,
			),
			npmplusAccessListIds: globalAclIds,
			locations,
		};

		try {
			await setProxyHost(payload);
			showObjectSuccess("proxy-host", "saved");
			remove();
		} catch (err) {
			if (err.payload?.error?.certificate_id) {
				setFieldValue("certificateId", err.payload.error.certificate_id);
			}
			if (err.payload?.error?.output) {
				setErrorMsg(<CommandOutput output={err.payload.error.output} />);
			} else {
				setErrorMsg(<T id={err.message} />);
			}
		}
	};

	return (
		<Modal show={visible} backdrop={canManage ? "static" : true} onHide={close}>
			<Modal.Header closeButton>
				<Modal.Title>
					<T id={id !== "new" && !isClone ? "object.edit" : "object.add"} tData={{ object: "proxy-host" }} />
				</Modal.Title>
			</Modal.Header>
			{error && (
				<Alert variant="danger" className="m-3">
					{error?.message}
				</Alert>
			)}
			{isPending && <Loading noLogo />}
			{data && (
				<Formik innerRef={formRef} initialValues={initialValues} onSubmit={onSubmit}>
					{({ values }) => (
						<Form onInvalid={showTabOfInvalid}>
							<Modal.Body className="p-0">
								<Alert variant="danger" show={errorMsg} onClose={() => setErrorMsg(null)} dismissible>
									{errorMsg}
								</Alert>
								<div className="card m-0 border-0">
									<div className="card-header">
										<ul className="nav nav-tabs card-header-tabs" data-bs-toggle="tabs">
											<li className="nav-item">
												<a href="#tab-details" className="nav-link active" data-bs-toggle="tab">
													<T id="column.details" />
												</a>
											</li>
											<li className="nav-item">
												<a href="#tab-locations" className="nav-link" data-bs-toggle="tab">
													{<T id="column.custom-locations" />}
													{values?.locations?.length > 0 ? "*" : ""}
												</a>
											</li>
											<li className="nav-item">
												<a href="#tab-ssl" className="nav-link" data-bs-toggle="tab">
													<T id="column.ssl" />
												</a>
											</li>
											<li className="nav-item ms-auto">
												<a href="#tab-advanced" className="nav-link" data-bs-toggle="tab">
													<T id="domains.advanced" />
													{values?.advancedConfig?.trim() ? "*" : ""}
												</a>
											</li>
										</ul>
									</div>
									<div className="card-body">
										<div className="tab-content">
											<fieldset
												className="tab-pane active show"
												id="tab-details"
												disabled={!canManage}
											>
												<div className="row">
													<DomainNamesField
														disabled={!canManage}
														isWildcardPermitted={
															values.certificateId !== "new" || values.npmplusDnsProvider
														}
														dnsProviderWildcardSupported
														forCertificate={values.certificateId === "new"}
													/>
													<div className="col-md-auto text-end">
														<div className="mb-3">
															<div className="form-label invisible">​</div>
															<button
																type="button"
																className="btn p-0"
																title={intl.formatMessage({ id: "nginx-config.label" })}
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
													loadBalanceMethod={values.npmplusLoadBalanceMethod}
													loadBalanceMethodFieldName="npmplusLoadBalanceMethod"
													upstreamServers={values.npmplusUpstreamServers?.length
													? values.npmplusUpstreamServers
													: [
															{
																host: "",
																port: null,
																backup: false,
																down: false,
															},
														]}
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
																htmlFor="npmplusDisableCrowdsecAppsec"
															>
																<span className="col">
																	<T id="host.flags.disable-crowdsec-appsec" />
																</span>
																<span className="col-auto">
																	<Field
																		name="npmplusDisableCrowdsecAppsec"
																		type="checkbox"
																	>
																		{({ field, form }) => (
																			<span className="form-check form-check-single form-switch">
																				<input
																					{...field}
																					id="npmplusDisableCrowdsecAppsec"
																					className={cn("form-check-input", {
																						"bg-lime": field.checked,
																					})}
																					type="checkbox"
																					onChange={(e) => {
																						field.onChange(e);
																						if (!e.target.checked) {
																							form.setFieldValue(
																								"npmplusDisableProxyRequestBuffering",
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
																htmlFor="npmplusDisableProxyRequestBuffering"
															>
																<span className="col">
																	<T id="host.flags.disable-request-buffering" />
																</span>
																<span className="col-auto">
																	<Field
																		name="npmplusDisableProxyRequestBuffering"
																		type="checkbox"
																	>
																		{({ field, form }) => (
																			<span
																				className="form-check form-check-single form-switch"
																				title={requestBufferingTitle(
																					form.values,
																				)}
																			>
																				<input
																					{...field}
																					id="npmplusDisableProxyRequestBuffering"
																					className={cn("form-check-input", {
																						"bg-lime": field.checked,
																					})}
																					type="checkbox"
																					disabled={
																						!form.values
																							.npmplusDisableCrowdsecAppsec ||
																						!["http", "https"].includes(
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
																	<T id="host.flags.response-buffering" />
																</span>
																<span className="col-auto">
																	<Field name="npmplusProxyResponseBuffering">
																		{({ field, form }) => (
																			<select
																				id="npmplusProxyResponseBuffering"
																				className="form-select"
																				required
																				{...field}
																				disabled={
																					form.values.forwardScheme !==
																						"http" &&
																					form.values.forwardScheme !==
																						"https"
																				}
																			>
																				<option value="on_auto">
																					<T id="host.flags.response-buffering.on-auto" />
																				</option>
																				<option value="on_forced">
																					<T id="host.flags.response-buffering.on-forced" />
																				</option>
																				<option value="ram_only_auto">
																					<T id="host.flags.response-buffering.ram-only-auto" />
																				</option>
																				<option value="ram_only_forced">
																					<T id="host.flags.response-buffering.ram-only-forced" />
																				</option>
																				<option value="off_auto">
																					<T id="host.flags.response-buffering.off-auto" />
																				</option>
																				<option value="off_forced">
																					<T id="host.flags.response-buffering.off-forced" />
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
																			validate={validateUpstreamUrl}
																		>
																			{({ field, meta }) => (
																				<>
																					<input
																						id="npmplusAuthRequestUpstream"
																						type="text"
																						className={`form-control ${meta.touched && meta.error ? "is-invalid" : ""}`}
																						placeholder={intl.formatMessage(
																							{
																								id: "host.auth-request-upstream.placeholder",
																							},
																						)}
																						maxLength={255}
																						pattern="^https?://(([^\s\/:]+|\[[a-fA-F0-9:]+\]):[0-9]+|cu_[^\s\/:]+)$"
																						{...field}
																					/>

																					<ErrorMessage
																						name="npmplusAuthRequestUpstream"
																						component="div"
																						className="invalid-feedback"
																					/>
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
														disabled={!canManage}
														name="npmplusAccessListIds"
														typeFieldName="npmplusAccessListType"
														authRequest={values.npmplusAuthRequest}
													/>
												</div>
												{(advVisible ||
													(!canManage && values?.npmplusLocationConfig?.trim())) && (
													<div className="">
														<Field name="npmplusLocationConfig">
															{({ field }) => (
																<textarea
																	className="form-control font-monospace"
																	spellCheck={false}
																	placeholder={intl.formatMessage({
																		id: "nginx-config.placeholder",
																	})}
																	rows={8}
																	disabled={!currentUser?.npmplusIsAdmin}
																	{...field}
																/>
															)}
														</Field>
													</div>
												)}
											</fieldset>
											<div className="tab-pane" id="tab-locations">
												<LocationsFields disabled={!canManage} isClone={isClone} />
											</div>
											<fieldset className="tab-pane" id="tab-ssl" disabled={!canManage}>
												<SSLCertificateField
													disabled={!canManage}
													name="certificateId"
													label="ssl-certificate"
													allowNew
												/>

												<SSLOptionsFields color="bg-lime" forProxyHost />
											</fieldset>
											<fieldset className="tab-pane" id="tab-advanced" disabled={!canManage}>
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
											</fieldset>
										</div>
									</div>
								</div>
							</Modal.Body>
							<Modal.Footer>
								<Button onClick={close}>
									<T id={canManage ? "cancel" : "action.close"} />
								</Button>
								{canManage && (
									<Button type="submit" color="lime" className="ms-auto">
										<T id="save" />
									</Button>
								)}
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
