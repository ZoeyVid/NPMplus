import cn from "clsx";
import { ErrorMessage, Field, Form, Formik } from "formik";
import { useState } from "react";
import { Alert } from "react-bootstrap";
import Modal from "react-bootstrap/Modal";
import {
	Button,
	CommandOutput,
	DirectoryField,
	DomainNamesField,
	Loading,
	NginxConfigField,
	SSLCertificateField,
	SSLOptionsFields,
} from "src/components";
import {
	useDirectorySuggestions,
	useRedirectionHost,
	useRedirectionHosts,
	useSetRedirectionHost,
	useUser,
} from "src/hooks";
import { T } from "src/locale";
import EasyModal from "src/modules/easyModal";
import { initTabs } from "src/modules/Focus";
import { hasPermission, MANAGE, REDIRECTION_HOSTS } from "src/modules/Permissions";
import { showTabOfInvalid, validateString } from "src/modules/Validations";
import { showObjectSuccess } from "src/notifications";

const showRedirectionHostModal = (id) => {
	EasyModal.show(RedirectionHostModal, { id });
};

const RedirectionHostModal = EasyModal.create(({ id, visible, remove, close, formRef }) => {
	const { data, isPending, error } = useRedirectionHost(id);
	const { mutateAsync: setRedirectionHost } = useSetRedirectionHost();
	const { data: allRedirectionHosts } = useRedirectionHosts();
	const suggestions = useDirectorySuggestions(allRedirectionHosts);
	const { data: currentUser } = useUser("me");
	const canManage = hasPermission(REDIRECTION_HOSTS, MANAGE, currentUser?.permissions, currentUser?.npmplusIsAdmin);
	const [errorMsg, setErrorMsg] = useState(null);

	const onSubmit = async (values, { setFieldValue }) => {
		setErrorMsg(null);

		const payload = {
			id: id === "new" ? undefined : id,
			...values,
		};

		try {
			await setRedirectionHost(payload);
			showObjectSuccess("redirection-host", "saved");
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
					<T id={id !== "new" ? "object.edit" : "object.add"} tData={{ object: "redirection-host" }} />
				</Modal.Title>
			</Modal.Header>
			{error && (
				<Alert variant="danger" className="m-3">
					{error?.message}
				</Alert>
			)}
			{isPending && <Loading noLogo />}
			{data && (
				<Formik
					innerRef={formRef}
					initialValues={{
						// Details tab
						domainNames: data?.domainNames,
						forwardDomainName: data?.forwardDomainName,
						forwardScheme: data?.forwardScheme,
						forwardHttpCode: data?.forwardHttpCode,
						preservePath: data?.preservePath,
						// SSL tab
						certificateId: data?.certificateId,
						sslForced: data?.sslForced,
						npmplusHttp3Support: data?.npmplusHttp3Support,
						hstsEnabled: data?.hstsEnabled,
						hstsSubdomains: data?.hstsSubdomains,
						// Advanced tab
						advancedConfig: data?.advancedConfig,
						npmplusDirectory: data?.npmplusDirectory,
						npmplusMtlsCertificateId: data?.npmplusMtlsCertificateId,
						npmplusMtlsVerifyClientOptional: data?.npmplusMtlsVerifyClientOptional,
					}}
					onSubmit={onSubmit}
				>
					{({ values, isSubmitting }) => (
						<Form onInvalid={showTabOfInvalid}>
							<Modal.Body className="p-0">
								<Alert variant="danger" show={errorMsg} onClose={() => setErrorMsg(null)} dismissible>
									{errorMsg}
								</Alert>
								<div className="card m-0 border-0">
									<div className="card-header">
										<ul
											className="nav nav-tabs card-header-tabs"
											data-bs-toggle="tabs"
											ref={initTabs}
										>
											<li className="nav-item">
												<a href="#tab-details" className="nav-link active" data-bs-toggle="tab">
													<T id="column.details" />
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
										<fieldset className="tab-content" disabled={!canManage}>
											<div className="tab-pane active show" id="tab-details">
												<DomainNamesField
													disabled={!canManage}
													isWildcardPermitted={
														values.certificateId !== "new" || values.npmplusDnsChallenge
													}
													dnsProviderWildcardSupported
													forCertificate={values.certificateId === "new"}
												/>
												<div className="row">
													<div className="col-md-4">
														<Field name="forwardScheme">
															{({ field }) => (
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
																	>
																		<option value="$scheme">keep</option>
																		<option value="http">http</option>
																		<option value="https">https</option>
																	</select>
																</div>
															)}
														</Field>
													</div>
													<div className="col-md-8">
														<Field
															name="forwardDomainName"
															validate={(value) => validateString(value, 1, 253)}
														>
															{({ field, meta }) => (
																<div className="mb-3">
																	<label
																		className="form-label"
																		htmlFor="forwardDomainName"
																	>
																		<T id="redirection-host.forward-domain" />
																	</label>
																	<input
																		id="forwardDomainName"
																		type="text"
																		className={`form-control ${meta.touched && meta.error ? "is-invalid" : ""}`}
																		required
																		pattern="\S+"
																		placeholder="example.com"
																		{...field}
																	/>

																	<ErrorMessage
																		name="forwardDomainName"
																		component="div"
																		className="invalid-feedback"
																	/>
																</div>
															)}
														</Field>
													</div>
												</div>
												<Field name="forwardHttpCode">
													{({ field, form }) => (
														<div className="mb-3">
															<label className="form-label" htmlFor="forwardHttpCode">
																<T id="redirection-host.forward-http-code" />
															</label>
															<select
																id="forwardHttpCode"
																className="form-select"
																required
																{...field}
																onChange={(e) =>
																	form.setFieldValue(
																		field.name,
																		Number(e.target.value),
																	)
																}
															>
																<option value="301">
																	<T id="redirection-hosts.http-code.301" />
																</option>
																<option value="302">
																	<T id="redirection-hosts.http-code.302" />
																</option>
																<option value="303">
																	<T id="redirection-hosts.http-code.303" />
																</option>
																<option value="307">
																	<T id="redirection-hosts.http-code.307" />
																</option>
																<option value="308">
																	<T id="redirection-hosts.http-code.308" />
																</option>
															</select>
														</div>
													)}
												</Field>
												<div className="my-3">
													<h4 className="py-2">
														<T id="options" />
													</h4>
													<div className="divide-y">
														<div>
															<label
																className="row cursor-pointer"
																htmlFor="preservePath"
															>
																<span className="col">
																	<T id="host.flags.preserve-path" />
																</span>
																<span className="col-auto">
																	<Field name="preservePath" type="checkbox">
																		{({ field }) => (
																			<span className="form-check form-check-single form-switch">
																				<input
																					{...field}
																					id="preservePath"
																					className={cn("form-check-input", {
																						"bg-yellow": field.checked,
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
											</div>
											<div className="tab-pane" id="tab-ssl">
												<SSLCertificateField
													disabled={!canManage}
													name="certificateId"
													label="ssl-certificate"
													allowNew
												/>

												<SSLOptionsFields color="bg-yellow" />
											</div>
											<div className="tab-pane" id="tab-advanced">
												<NginxConfigField />
												<div className="row mt-3">
													<div className="col-md-12 mb-3">
														<DirectoryField
															labelId="redirection-host.directory"
															datalistId="directory-suggestions-redirection"
															suggestions={suggestions}
														/>
													</div>
												</div>
											</div>
										</fieldset>
									</div>
								</div>
							</Modal.Body>
							<Modal.Footer>
								<Button onClick={close} disabled={isSubmitting}>
									<T id={canManage ? "cancel" : "action.close"} />
								</Button>
								{canManage && (
									<Button
										type="submit"
										color="yellow"
										className="ms-auto"
										isLoading={isSubmitting}
										disabled={isSubmitting}
									>
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

export { showRedirectionHostModal };
