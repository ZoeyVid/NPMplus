import { IconAlertTriangle } from "@tabler/icons-react";
import cn from "clsx";
import { Field, Form, Formik } from "formik";
import { useState } from "react";
import { Alert } from "react-bootstrap";
import Modal from "react-bootstrap/Modal";
import { createCertificate, testHttpCertificate } from "src/api/backend";
import { Button, CommandOutput, DomainNamesField } from "src/components";
import { T } from "src/locale";
import EasyModal from "src/modules/easyModal";
import { showObjectSuccess } from "src/notifications";

const showHTTPCertificateModal = () => {
	EasyModal.show(HTTPCertificateModal);
};

const HTTPCertificateModal = EasyModal.create(({ visible, remove, close, formRef }) => {
	const [errorMsg, setErrorMsg] = useState(null);
	const [isTesting, setIsTesting] = useState(false);
	const [testResults, setTestResults] = useState(null);

	const onSubmit = async (values) => {
		setErrorMsg(null);

		try {
			await createCertificate(values);
			showObjectSuccess("certificate", "saved");
			remove();
		} catch (err) {
			if (err.payload?.error?.output) {
				setErrorMsg(<CommandOutput output={err.payload.error.output} />);
			} else {
				setErrorMsg(<T id={err.message} />);
			}
		}
	};

	const handleTest = async (domains) => {
		setIsTesting(true);
		setErrorMsg(null);
		setTestResults(null);
		try {
			const result = await testHttpCertificate(domains);
			setTestResults(result);
		} catch (err) {
			setErrorMsg(<T id={err.message} />);
		}
		setIsTesting(false);
	};

	const parseTestResults = () => (
		<>
			{testResults.map((testResult) => {
				const { domain, status } = testResult;
				let messageComponent;

				switch (status) {
					case "ok":
						messageComponent = <T id="certificates.http.reachability-ok" />;
						break;
					case "no-host":
						messageComponent = <T id="certificates.http.reachability-not-resolved" />;
						break;
					case "failed":
						messageComponent = <T id="certificates.http.reachability-failed-to-check" />;
						break;
					case "404":
						messageComponent = <T id="certificates.http.reachability-404" />;
						break;
					case "wrong-data":
						messageComponent = <T id="certificates.http.reachability-wrong-data" />;
						break;
					default: {
						const code = status.slice(6);
						messageComponent = <T id="certificates.http.reachability-other" data={{ code }} />;
						break;
					}
				}

				return (
					<p key={domain}>
						<strong>{domain}:</strong> {messageComponent}
					</p>
				);
			})}
		</>
	);

	return (
		<Modal show={visible} backdrop="static" onHide={isTesting ? undefined : close}>
			<Formik
				innerRef={formRef}
				initialValues={{
					domainNames: [],
					provider: "letsencrypt",
					npmplusReuseKey: false,
				}}
				onSubmit={onSubmit}
			>
				{({ values, isSubmitting }) => (
					<Form>
						<Modal.Header closeButton={!(isSubmitting || isTesting)}>
							<Modal.Title>
								<T id="object.add" tData={{ object: "lets-encrypt-via-http" }} />
							</Modal.Title>
						</Modal.Header>
						<Modal.Body className="p-0">
							<Alert variant="danger" show={errorMsg} onClose={() => setErrorMsg(null)} dismissible>
								{errorMsg}
							</Alert>
							<div className="card m-0 border-0">
								<div className="card-body">
									<p className="text-warning">
										<IconAlertTriangle size={16} className="me-1" />
										<T id="certificates.http.warning" />
									</p>
									<DomainNamesField forCertificate onChange={() => setTestResults(null)} />

									<div className="row">
										<div className="col-6">
											<Field name="npmplusReuseKey" type="checkbox">
												{({ field }) => (
													<label className="form-check form-switch mt-1">
														<input
															{...field}
															type="checkbox"
															className={cn("form-check-input", {
																"bg-cyan": field.checked,
															})}
														/>

														<span className="form-check-label">
															<T id="domains.reuse-key" />
														</span>
													</label>
												)}
											</Field>
										</div>
									</div>
								</div>
								{testResults ? (
									<div className="card-footer">
										<h5>
											<T id="certificates.http.test-results" />
										</h5>
										{parseTestResults()}
									</div>
								) : null}
							</div>
						</Modal.Body>
						<Modal.Footer>
							<div role="status" className="visually-hidden">
								{isSubmitting && <T id="please-wait" />}
							</div>
							<Button onClick={close} disabled={isSubmitting || isTesting}>
								<T id="cancel" />
							</Button>
							<div className="ms-auto">
								<Button
									type="button"
									actionType="secondary"
									className="me-3"
									isLoading={isTesting}
									disabled={isSubmitting || values.domainNames.length === 0}
									onClick={() => handleTest(values.domainNames)}
								>
									<T id="test" />
								</Button>
								<Button
									type="submit"
									color="pink"
									isLoading={isSubmitting}
									disabled={isSubmitting || isTesting}
								>
									<T id="save" />
								</Button>
							</div>
						</Modal.Footer>
					</Form>
				)}
			</Formik>
		</Modal>
	);
});

export { showHTTPCertificateModal };
