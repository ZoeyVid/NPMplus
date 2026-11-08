import { Form, Formik } from "formik";
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
import { useDeadHost, useDeadHosts, useDirectorySuggestions, useSetDeadHost, useUser } from "src/hooks";
import { T } from "src/locale";
import EasyModal from "src/modules/easyModal";
import { initTabs } from "src/modules/Focus";
import { DEAD_HOSTS, hasPermission, MANAGE } from "src/modules/Permissions";
import { showTabOfInvalid } from "src/modules/Validations";
import { showObjectSuccess } from "src/notifications";

const showDeadHostModal = (id) => {
	EasyModal.show(DeadHostModal, { id });
};

const DeadHostModal = EasyModal.create(({ id, visible, remove, close, formRef }) => {
	const { data, isPending, error } = useDeadHost(id);
	const { mutateAsync: setDeadHost } = useSetDeadHost();
	const { data: allDeadHosts } = useDeadHosts();
	const suggestions = useDirectorySuggestions(allDeadHosts);
	const { data: currentUser } = useUser("me");
	const canManage = hasPermission(DEAD_HOSTS, MANAGE, currentUser?.permissions, currentUser?.npmplusIsAdmin);
	const [errorMsg, setErrorMsg] = useState(null);

	const onSubmit = async (values, { setFieldValue }) => {
		setErrorMsg(null);

		const payload = {
			id: id === "new" ? undefined : id,
			...values,
		};

		try {
			await setDeadHost(payload);
			showObjectSuccess("dead-host", "saved");
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
					<T id={id !== "new" ? "object.edit" : "object.add"} tData={{ object: "dead-host" }} />
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
											</div>
											<div className="tab-pane" id="tab-ssl">
												<SSLCertificateField
													disabled={!canManage}
													name="certificateId"
													label="ssl-certificate"
													allowNew
												/>

												<SSLOptionsFields color="bg-red" />
											</div>
											<div className="tab-pane" id="tab-advanced">
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
										color="red"
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

export { showDeadHostModal };
