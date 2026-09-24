import { Field, Form, Formik } from "formik";
import { useState } from "react";
import { Alert } from "react-bootstrap";
import Modal from "react-bootstrap/Modal";
import { Button, DirectoryField, Loading, NginxConfigField, SSLCertificateField } from "src/components";
import { useDirectorySuggestions, useSetStream, useStream, useStreams } from "src/hooks";
import { intl, T } from "src/locale";
import EasyModal from "src/modules/easyModal";
import { showTabOfInvalid, validateString } from "src/modules/Validations";
import { showObjectSuccess } from "src/notifications";
import { ForwardHostFields, CleanUpstreamServers, CleanLoadBalanceMethod } from "../components/Form/ForwardHostFields";

const showStreamModal = (id) => {
	EasyModal.show(StreamModal, { id });
};

const StreamModal = EasyModal.create(({ id, visible, remove }) => {
	const { data, isLoading, error } = useStream(id);
	const { data: allStreams } = useStreams();
	const suggestions = useDirectorySuggestions(allStreams);
	const { mutate: setStream } = useSetStream();
	const [errorMsg, setErrorMsg] = useState(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const onSubmit = (values, { setSubmitting }) => {
		if (isSubmitting) return;
		setIsSubmitting(true);
		setErrorMsg(null);		

		const meta = { ...(values.meta || {}) };
		if (typeof meta.directory === "string") {
			const trimmed = meta.directory.trim();
			if (trimmed) {
				meta.directory = trimmed;
			} else {
				delete meta.directory;
			}
		} else {
			delete meta.directory;
		}

		const { ...payload } = {
			id: id === "new" ? undefined : id,
			...values,
			// remove entries that are null or undefined or empty to pass schema validation
			npmplusUpstreamServers: CleanUpstreamServers(
				values.npmplusUpstreamServers,
			),
			meta,
		};
		// Keep payload construction separate from submission cleanup so future cleanup steps remain explicit
		const cleanPayload = CleanLoadBalanceMethod(payload);

		setStream(cleanPayload, {
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
				showObjectSuccess("stream", "saved");
				remove();
			},
			onSettled: () => {
				setIsSubmitting(false);
				setSubmitting(false);
			},
		});
	};

	return (
		<Modal show={visible} onHide={remove}>
			{!isLoading && error && (
				<Alert variant="danger" className="m-3">
					{error?.message || "Unknown error"}
				</Alert>
			)}
			{isLoading && <Loading noLogo />}
			{!isLoading && data && (
				<Formik
					initialValues={{
						incomingPort: data?.incomingPort,
						npmplusLoadBalanceMethod: data?.npmplusLoadBalanceMethod || "round_robin",
						npmplusUpstreamServers: data?.npmplusUpstreamServers?.length ? 
														data.npmplusUpstreamServers :
																				[
																					{
																						host: "",
																						port: null,
																						backup: false,
																						down: false,
																					},
																				],
						tcpForwarding: data?.tcpForwarding,
						udpForwarding: data?.udpForwarding,
						npmplusProxyProtocolForwarding: data?.npmplusProxyProtocolForwarding,
						npmplusProxyTls: data?.npmplusProxyTls,
						certificateId: data?.certificateId,
						npmplusAdvancedConfig: data?.npmplusAdvancedConfig || "",
						meta: data?.meta || {},
						npmplusDescription: data?.npmplusDescription || "",
					}}
					onSubmit={onSubmit}
				>
					{({ values, setFieldValue }) => (
						<Form onInvalid={showTabOfInvalid}>
							<Modal.Header closeButton>
								<Modal.Title>
									<T id={data?.id ? "object.edit" : "object.add"} tData={{ object: "stream" }} />
								</Modal.Title>
							</Modal.Header>
							<Modal.Body className="p-0">
								<Alert
									variant="danger"
									show={Boolean(errorMsg)}
									onClose={() => setErrorMsg(null)}
									dismissible
								>
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
													href="#tab-ssl"
													className={`nav-link ${values.udpForwarding ? "disabled" : ""}`}
													data-bs-toggle={values.udpForwarding ? undefined : "tab"}
													aria-selected="false"
													aria-disabled={values.udpForwarding}
													tabIndex={-1}
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
													tabIndex={-1}
													role="tab"
												>
													<T id="domains.advanced" />
													{values?.npmplusAdvancedConfig?.trim() ? "*" : ""}
												</a>
											</li>
										</ul>
									</div>
									<div className="card-body">
										<div className="tab-content">
											<div className="tab-pane active show" id="tab-details" role="tabpanel">
												<Field name="incomingPort" validate={validateString(1, 11)}>
													{({ field, form }) => (
														<div className="mb-3">
															<label className="form-label" htmlFor="incomingPort">
																<T id="stream.incoming-port" />
															</label>
															<input
																id="incomingPort"
																type="text"
																minLength={1}
																maxLength={11}
																className={`form-control ${form.errors.incomingPort && form.touched.incomingPort ? "is-invalid" : ""}`}
																required
																placeholder="eg: 8080"
																{...field}
															/>

															{form.errors.incomingPort ? (
																<div className="invalid-feedback">
																	{form.errors.incomingPort &&
																	form.touched.incomingPort
																		? form.errors.incomingPort
																		: null}
																</div>
															) : null}
														</div>
													)}
												</Field>
												<Field name="npmplusDescription" validate={validateString(0, 255)}>
													{({ field, form }) => (
														<div className="mb-3">
															<label className="form-label" htmlFor="npmplusDescription">
																<T id="stream.description" />
															</label>
															<input
																id="npmplusDescription"
																type="text"
																maxLength={255}
																className={`form-control ${form.errors.npmplusDescription && form.touched.npmplusDescription ? "is-invalid" : ""}`}
																placeholder={intl.formatMessage({
																	id: "stream.description.placeholder",
																})}
																{...field}
															/>

															{form.errors.npmplusDescription ? (
																<div className="invalid-feedback">
																	{form.errors.npmplusDescription &&
																	form.touched.npmplusDescription
																		? form.errors.npmplusDescription
																		: null}
																</div>
															) : null}
														</div>
													)}
												</Field>
												<div className="row">
													<ForwardHostFields
														idPrefix="stream-host"
														loadBalanceMethod={values.npmplusLoadBalanceMethod}
														loadBalanceMethodFieldName="npmplusLoadBalanceMethod"
														upstreamServers={values.npmplusUpstreamServers}
														streams={true}
													/>
												</div>
												<div className="my-3">
													<h3 className="py-2">
														<T id="host.flags.protocols" />
													</h3>
													<div className="divide-y">
														<div>
															<label className="row" htmlFor="tcpForwarding">
																<span className="col">
																	<T id="streams.tcp" />
																</span>
																<span className="col-auto">
																	<Field name="tcpForwarding" type="checkbox">
																		{({ field }) => (
																			<span className="form-check form-check-single form-switch">
																				<input
																					id="tcpForwarding"
																					className="form-check-input"
																					type="checkbox"
																					name={field.name}
																					checked={field.value}
																					onChange={(e) => {
																						setFieldValue(
																							field.name,
																							e.target.checked,
																						);
																						if (!e.target.checked) {
																							setFieldValue(
																								"udpForwarding",
																								true,
																							);
																							if (
																								values.npmplusProxyProtocolForwarding ===
																								1
																							) {
																								setFieldValue(
																									"npmplusProxyProtocolForwarding",
																									0,
																								);
																							}
																							setFieldValue(
																								"npmplusProxyTls",
																								false,
																							);
																							setFieldValue(
																								"certificateId",
																								0,
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
															<label className="row" htmlFor="udpForwarding">
																<span className="col">
																	<T id="streams.udp" />
																</span>
																<span className="col-auto">
																	<Field name="udpForwarding" type="checkbox">
																		{({ field }) => (
																			<span className="form-check form-check-single form-switch">
																				<input
																					id="udpForwarding"
																					className="form-check-input"
																					type="checkbox"
																					name={field.name}
																					checked={field.value}
																					onChange={(e) => {
																						setFieldValue(
																							field.name,
																							e.target.checked,
																						);

																						if (e.target.checked) {
																							if (
																								values.npmplusProxyProtocolForwarding ===
																								1
																							) {
																								setFieldValue(
																									"npmplusProxyProtocolForwarding",
																									0,
																								);
																							}
																							setFieldValue(
																								"npmplusProxyTls",
																								false,
																							);
																							setFieldValue(
																								"certificateId",
																								0,
																							);
																							setFieldValue(
																								"meta.npmplusMtlsCertificateId",
																								0,
																							);
																							setFieldValue(
																								"meta.npmplusMtlsVerifyClientOptional",
																								false,
																							);
																						}

																						if (!e.target.checked) {
																							setFieldValue(
																								"tcpForwarding",
																								true,
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
															<label className="row" htmlFor="npmplusProxyTls">
																<span className="col">
																	<T id="streams.tls" />
																</span>
																<span className="col-auto">
																	<Field name="npmplusProxyTls" type="checkbox">
																		{({ field }) => (
																			<span className="form-check form-check-single form-switch">
																				<input
																					id="npmplusProxyTls"
																					className="form-check-input"
																					type="checkbox"
																					name={field.name}
																					checked={field.value}
																					disabled={values.udpForwarding}
																					onChange={(e) => {
																						setFieldValue(
																							field.name,
																							e.target.checked,
																						);
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
																className="row"
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
											<div className="tab-pane" id="tab-ssl" role="tabpanel">
												<SSLCertificateField
													name="certificateId"
													label="ssl-certificate"
													allowNew={false}
													forHttp={false}
												/>

												<div className="row">
													<div className="col-12">
														<Field name="meta.npmplusMtlsVerifyClientOptional">
															{({ field }) => (
																<label className="form-check form-switch mt-1">
																	<input
																		className="form-check-input"
																		type="checkbox"
																		checked={
																			values?.meta
																				?.npmplusMtlsVerifyClientOptional ===
																			true
																		}
																		onChange={(e) => {
																			setFieldValue(field.name, e.target.checked);
																		}}
																		disabled={
																			!(
																				values?.certificateId > 0 &&
																				values?.meta?.npmplusMtlsCertificateId >
																					0
																			) || values?.udpForwarding
																		}
																	/>

																	<span className="form-check-label">
																		<T id="domains.mtls-verify-client-optional" />
																	</span>
																</label>
															)}
														</Field>
													</div>
												</div>
											</div>
											<div className="tab-pane" id="tab-advanced" role="tabpanel">
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
										</div>
									</div>
								</div>
							</Modal.Body>
							<Modal.Footer>
								<Button onClick={remove} disabled={isSubmitting}>
									<T id="cancel" />
								</Button>
								<Button
									type="submit"
									actionType="primary"
									className="ms-auto"
									isLoading={isSubmitting}
									disabled={isSubmitting}
								>
									<T id="save" />
								</Button>
							</Modal.Footer>
						</Form>
					)}
				</Formik>
			)}
		</Modal>
	);
});

export { showStreamModal };
