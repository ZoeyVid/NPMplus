import { ErrorMessage, Field, Form, Formik } from "formik";
import { useState } from "react";
import { Alert } from "react-bootstrap";
import Modal from "react-bootstrap/Modal";
import {
	Button,
	CommandOutput,
	DirectoryField,
	Loading,
	NginxConfigField,
	SSLCertificateField,
	SSLOptionsFields,
} from "src/components";
import { useDirectorySuggestions, useSetStream, useStream, useStreams, useUser } from "src/hooks";
import { intl, T } from "src/locale";
import EasyModal from "src/modules/easyModal";
import { initTabs } from "src/modules/Focus";
import { hasPermission, MANAGE, STREAMS } from "src/modules/Permissions";
import { showTabOfInvalid, validateString, validateUnixTarget } from "src/modules/Validations";
import { showObjectSuccess } from "src/notifications";

const showStreamModal = (id) => {
	EasyModal.show(StreamModal, { id });
};

const udpOnlyValues = ({
	npmplusReuseKey,
	npmplusDnsChallenge,
	npmplusDnsProvider,
	npmplusDnsProviderCredentials,
	npmplusPropagationSeconds,
	...values
}) => ({
	...values,
	udpForwarding: true,
	...(values.npmplusProxyProtocolForwarding === 1 && { npmplusProxyProtocolForwarding: 2 }),
	npmplusProxyTls: false,
	certificateId: 0,
	npmplusMtlsCertificateId: 0,
	npmplusMtlsVerifyClientOptional: false,
});

const StreamModal = EasyModal.create(({ id, visible, remove, close, formRef }) => {
	const { data, isPending, error } = useStream(id);
	const { data: allStreams } = useStreams();
	const suggestions = useDirectorySuggestions(allStreams);
	const { mutateAsync: setStream } = useSetStream();
	const { data: currentUser } = useUser("me");
	const canManage = hasPermission(STREAMS, MANAGE, currentUser?.permissions, currentUser?.npmplusIsAdmin);
	const [errorMsg, setErrorMsg] = useState(null);

	const onSubmit = async (values, { setFieldValue }) => {
		setErrorMsg(null);

		const payload = {
			id: id === "new" ? undefined : id,
			...values,
			domainNames: values.certificateId === "new" ? values.domainNames : undefined,
		};

		try {
			await setStream(payload);
			showObjectSuccess("stream", "saved");
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
					<T id={id !== "new" ? "object.edit" : "object.add"} tData={{ object: "stream" }} />
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
						incomingPort: data?.incomingPort,
						forwardingHost: data?.forwardingHost,
						forwardingPort: data?.forwardingPort,
						tcpForwarding: data?.tcpForwarding,
						udpForwarding: data?.udpForwarding,
						npmplusProxyProtocolForwarding: data?.npmplusProxyProtocolForwarding,
						npmplusProxyTls: data?.npmplusProxyTls,
						certificateId: data?.certificateId,
						npmplusAdvancedConfig: data?.npmplusAdvancedConfig,
						npmplusDirectory: data?.npmplusDirectory,
						npmplusMtlsCertificateId: data?.npmplusMtlsCertificateId,
						npmplusMtlsVerifyClientOptional: data?.npmplusMtlsVerifyClientOptional,
						npmplusDescription: data?.npmplusDescription,
					}}
					onSubmit={onSubmit}
				>
					{({ values, setFieldValue, setValues, isSubmitting }) => (
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
												<a
													href="#tab-ssl"
													className={`nav-link ${values.udpForwarding ? "disabled" : ""}`}
													data-bs-toggle={values.udpForwarding ? undefined : "tab"}
												>
													<T id="column.ssl" />
												</a>
											</li>
											<li className="nav-item ms-auto">
												<a href="#tab-advanced" className="nav-link" data-bs-toggle="tab">
													<T id="domains.advanced" />
													{values?.npmplusAdvancedConfig?.trim() ? "*" : ""}
												</a>
											</li>
										</ul>
									</div>
									<div className="card-body">
										<fieldset className="tab-content" disabled={!canManage}>
											<div className="tab-pane active show" id="tab-details">
												<Field
													name="incomingPort"
													validate={(value) => validateString(value, 1, 11)}
												>
													{({ field, meta }) => (
														<div className="mb-3">
															<label className="form-label" htmlFor="incomingPort">
																<T id="stream.incoming-port" />
															</label>
															<input
																id="incomingPort"
																type="text"
																minLength={1}
																maxLength={11}
																pattern="[0-9]{1,5}(-[0-9]{1,5})?"
																className={`form-control ${meta.touched && meta.error ? "is-invalid" : ""}`}
																required
																placeholder={intl.formatMessage(
																	{ id: "example" },
																	{ value: "8080" },
																)}
																{...field}
															/>

															<ErrorMessage
																name="incomingPort"
																component="div"
																className="invalid-feedback"
															/>
														</div>
													)}
												</Field>
												<Field name="npmplusDescription">
													{({ field }) => (
														<div className="mb-3">
															<label className="form-label" htmlFor="npmplusDescription">
																<T id="stream.description" />
															</label>
															<input
																id="npmplusDescription"
																type="text"
																maxLength={255}
																className="form-control"
																placeholder={intl.formatMessage({
																	id: "stream.description.placeholder",
																})}
																{...field}
															/>
														</div>
													)}
												</Field>
												<div className="row">
													<div className="col-md-8">
														<Field
															name="forwardingHost"
															validate={(value) =>
																validateString(value, 1, 253) ||
																validateUnixTarget(
																	value,
																	currentUser?.npmplusIsAdmin,
																	data?.forwardingHost,
																)
															}
														>
															{({ field, meta }) => (
																<div className="mb-3">
																	<label
																		className="form-label"
																		htmlFor="forwardingHost"
																	>
																		<T id="stream.forward-host" />
																	</label>
																	<input
																		id="forwardingHost"
																		type="text"
																		className={`form-control ${meta.touched && meta.error ? "is-invalid" : ""}`}
																		required
																		pattern="\S+"
																		placeholder={intl.formatMessage({
																			id: "stream.forward-host.placeholder",
																		})}
																		{...field}
																	/>

																	<ErrorMessage
																		name="forwardingHost"
																		component="div"
																		className="invalid-feedback"
																	/>
																</div>
															)}
														</Field>
													</div>
													<div className="col-md-4">
														<Field name="forwardingPort">
															{({ field }) => (
																<div className="mb-3">
																	<label
																		className="form-label"
																		htmlFor="forwardingPort"
																	>
																		<T id="host.forward-port" />
																	</label>
																	<input
																		id="forwardingPort"
																		type="text"
																		maxLength={12}
																		pattern="[0-9]{0,5}|\$server_port"
																		className="form-control"
																		placeholder={intl.formatMessage(
																			{ id: "example" },
																			{ value: "8081" },
																		)}
																		{...field}
																	/>
																</div>
															)}
														</Field>
													</div>
												</div>
												<div className="my-3">
													<h3 className="py-2">
														<T id="host.flags.protocols" />
													</h3>
													<div className="divide-y">
														<div>
															<label
																className="row cursor-pointer"
																htmlFor="tcpForwarding"
															>
																<span className="col">
																	<T id="streams.tcp" />
																</span>
																<span className="col-auto">
																	<Field name="tcpForwarding" type="checkbox">
																		{({ field }) => (
																			<span className="form-check form-check-single form-switch">
																				<input
																					{...field}
																					id="tcpForwarding"
																					className="form-check-input"
																					type="checkbox"
																					onChange={(e) => {
																						if (e.target.checked) {
																							field.onChange(e);
																						} else {
																							setValues({
																								...udpOnlyValues(
																									values,
																								),
																								tcpForwarding: false,
																							});
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
																htmlFor="udpForwarding"
															>
																<span className="col">
																	<T id="streams.udp" />
																</span>
																<span className="col-auto">
																	<Field name="udpForwarding" type="checkbox">
																		{({ field }) => (
																			<span className="form-check form-check-single form-switch">
																				<input
																					{...field}
																					id="udpForwarding"
																					className="form-check-input"
																					type="checkbox"
																					onChange={(e) => {
																						if (e.target.checked) {
																							setValues(
																								udpOnlyValues(values),
																							);
																						} else {
																							setValues({
																								...values,
																								udpForwarding: false,
																								tcpForwarding: true,
																							});
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
																htmlFor="npmplusProxyTls"
															>
																<span className="col">
																	<T id="streams.tls" />
																</span>
																<span className="col-auto">
																	<Field name="npmplusProxyTls" type="checkbox">
																		{({ field }) => (
																			<span className="form-check form-check-single form-switch">
																				<input
																					{...field}
																					id="npmplusProxyTls"
																					className="form-check-input"
																					type="checkbox"
																					disabled={values.udpForwarding}
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
																htmlFor="npmplusProxyProtocolForwarding"
															>
																<span className="col">
																	<T id="streams.pp" />
																</span>
																<span className="col-auto">
																	<Field name="npmplusProxyProtocolForwarding">
																		{({ field }) => (
																			<select
																				id="npmplusProxyProtocolForwarding"
																				className="form-select w-auto"
																				required
																				{...field}
																				onChange={(e) =>
																					setFieldValue(
																						field.name,
																						Number(e.target.value),
																					)
																				}
																			>
																				<option value={0}>
																					{intl.formatMessage({
																						id: "streams.pp.off",
																					})}
																				</option>
																				{values.tcpForwarding &&
																				!values.udpForwarding ? (
																					<option value={1}>
																						{intl.formatMessage({
																							id: "streams.pp.v1",
																						})}
																					</option>
																				) : null}
																				<option value={2}>
																					{intl.formatMessage({
																						id: "streams.pp.v2",
																					})}
																				</option>
																			</select>
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
													forHttp={false}
												/>

												<SSLOptionsFields color="bg-blue" forHttp={false} />
											</div>
											<div className="tab-pane" id="tab-advanced">
												<NginxConfigField
													name="npmplusAdvancedConfig"
													id="npmplusAdvancedConfig"
												/>

												<div className="row mt-3">
													<div className="col-md-12 mb-3">
														<DirectoryField
															labelId="stream.directory"
															datalistId="directory-suggestions-stream"
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
										actionType="primary"
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

export { showStreamModal };
