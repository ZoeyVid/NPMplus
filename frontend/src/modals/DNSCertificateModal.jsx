import cn from "clsx";
import { Field, Form, Formik } from "formik";
import { useState } from "react";
import { Alert } from "react-bootstrap";
import Modal from "react-bootstrap/Modal";
import { createCertificate } from "src/api/backend";
import { Button, CommandOutput, DNSProviderFields, DomainNamesField } from "src/components";
import { T } from "src/locale";
import EasyModal from "src/modules/easyModal";
import { showObjectSuccess } from "src/notifications";

const showDNSCertificateModal = () => {
	EasyModal.show(DNSCertificateModal);
};

const DNSCertificateModal = EasyModal.create(({ visible, remove, close, formRef }) => {
	const [errorMsg, setErrorMsg] = useState(null);

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

	return (
		<Modal show={visible} backdrop="static" onHide={close}>
			<Formik
				innerRef={formRef}
				initialValues={{
					domainNames: [],
					provider: "letsencrypt",
					npmplusDnsChallenge: true,
					npmplusReuseKey: false,
				}}
				onSubmit={onSubmit}
			>
				{({ isSubmitting }) => (
					<Form>
						<Modal.Header closeButton={!isSubmitting}>
							<Modal.Title>
								<T id="object.add" tData={{ object: "lets-encrypt-via-dns" }} />
							</Modal.Title>
						</Modal.Header>
						<Modal.Body className="p-0">
							<Alert variant="danger" show={errorMsg} onClose={() => setErrorMsg(null)} dismissible>
								{errorMsg}
							</Alert>
							<div className="card m-0 border-0">
								<div className="card-body">
									<DomainNamesField isWildcardPermitted dnsProviderWildcardSupported forCertificate />
									<DNSProviderFields />
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
							</div>
						</Modal.Body>
						<Modal.Footer>
							<Button onClick={close} disabled={isSubmitting}>
								<T id="cancel" />
							</Button>
							<Button
								type="submit"
								color="pink"
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
		</Modal>
	);
});

export { showDNSCertificateModal };
