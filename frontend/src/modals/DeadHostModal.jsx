import { Form, Formik } from "formik";
import { useState } from "react";
import { Alert } from "react-bootstrap";
import Modal from "react-bootstrap/Modal";
import {
	Button,
	DirectoryField,
	DomainNamesField,
	HasPermission,
	Loading,
	NginxConfigField,
	SSLCertificateField,
	SSLOptionsFields,
} from "src/components";
import { useDeadHost, useDeadHosts, useDirectorySuggestions, useSetDeadHost } from "src/hooks";
import { T } from "src/locale";
import EasyModal from "src/modules/easyModal";
import { DEAD_HOSTS, MANAGE } from "src/modules/Permissions";
import { showTabOfInvalid } from "src/modules/Validations";
import { showObjectSuccess } from "src/notifications";

const showDeadHostModal = (id) => {
	EasyModal.show(DeadHostModal, { id });
};

const DeadHostModal = EasyModal.create(({ id, visible, remove }) => {
	const { data, isPending, error } = useDeadHost(id);
	const { mutate: setDeadHost } = useSetDeadHost();
	const { data: allDeadHosts } = useDeadHosts();
	const suggestions = useDirectorySuggestions(allDeadHosts);
	const [errorMsg, setErrorMsg] = useState(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const onSubmit = (values, { setSubmitting }) => {
		if (isSubmitting) return;
		setIsSubmitting(true);
		setErrorMsg(null);

		const payload = {
			id: id === "new" ? undefined : id,
			...values,
		};

		setDeadHost(payload, {
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
				showObjectSuccess("dead-host", "saved");
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
						domainNames: data?.domainNames,
						certificateId: data?.certificateId,
						sslForced: data?.sslForced,
						advancedConfig: data?.advancedConfig,
						npmplusHttp3Support: data?.npmplusHttp3Support,
						hstsEnabled: data?.hstsEnabled,
						hstsSubdomains: data?.hstsSubdomains,
						npmplusDirectory: data?.npmplusDirectory,
						npmplusMtlsCertificateId: data?.npmplusMtlsCertificateId,
						npmplusMtlsVerifyClientOptional: data?.npmplusMtlsVerifyClientOptional,
					}}
					onSubmit={onSubmit}
				>
					{({ values }) => (
						<Form onInvalid={showTabOfInvalid}>
							<Modal.Header closeButton={!isSubmitting}>
								<Modal.Title>
									<T id={data?.id ? "object.edit" : "object.add"} tData={{ object: "dead-host" }} />
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
												<DomainNamesField
													isWildcardPermitted={
														values.certificateId !== "new" || values.npmplusDnsChallenge
													}
													dnsProviderWildcardSupported
													forCertificate={values.certificateId === "new"}
												/>
											</div>
											<div className="tab-pane" id="tab-ssl" role="tabpanel">
												<SSLCertificateField
													name="certificateId"
													label="ssl-certificate"
													allowNew
												/>

												<SSLOptionsFields color="bg-red" />
											</div>
											<div className="tab-pane" id="tab-advanced" role="tabpanel">
												<NginxConfigField />
												<div className="row mt-3">
													<div className="col-md-12 mb-3">
														<DirectoryField
															labelId="dead-host.directory"
															datalistId="directory-suggestions-dead"
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
								<HasPermission section={DEAD_HOSTS} permission={MANAGE} hideError>
									<Button
										type="submit"
										color="red"
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

export { showDeadHostModal };
