import { IconAlertTriangle } from "@tabler/icons-react";
import cn from "clsx";
import { ErrorMessage, Field, Form, Formik } from "formik";
import { useState } from "react";
import { Alert } from "react-bootstrap";
import Modal from "react-bootstrap/Modal";
import { createCertificate, deleteCertificate, uploadCertificate, validateCertificate } from "src/api/backend";
import { Button } from "src/components";
import { T } from "src/locale";
import EasyModal from "src/modules/easyModal";
import { validateString } from "src/modules/Validations";
import { showObjectSuccess } from "src/notifications";

const showCustomCertificateModal = (cert, provider) => {
	EasyModal.show(CustomCertificateModal, { cert, provider });
};

const CustomCertificateModal = EasyModal.create(({ visible, remove, close, formRef, cert, provider = "other" }) => {
	const [errorMsg, setErrorMsg] = useState(null);
	const isEdit = Boolean(cert);
	const isMtls = (cert?.provider ?? provider) === "mtls";

	const onSubmit = async (values) => {
		setErrorMsg(null);

		try {
			const { niceName, certificate, certificateKey } = values;
			const formData = new FormData();

			formData.append("certificate", certificate);
			if (!isMtls) {
				formData.append("certificate_key", certificateKey);
			}

			if (isEdit) {
				// Upload the certificates to the exiting certificate
				await uploadCertificate(cert.id, formData);
			} else {
				// Validate
				await validateCertificate(formData);

				// Create certificate with the specified provider
				const newCert = await createCertificate({
					niceName,
					provider,
				});

				// Upload the certificates to the created certificate
				try {
					await uploadCertificate(newCert.id, formData);
				} catch (err) {
					await deleteCertificate(newCert.id);
					throw err;
				}
			}

			// Success
			showObjectSuccess("certificate", "saved");
			remove();
		} catch (err) {
			setErrorMsg(<T id={err.message} />);
		}
	};

	return (
		<Modal show={visible} backdrop="static" onHide={close}>
			<Formik
				innerRef={formRef}
				initialValues={{
					niceName: cert?.niceName || "",

					certificate: null,
					certificateKey: null,
				}}
				onSubmit={onSubmit}
			>
				{() => (
					<Form>
						<Modal.Header closeButton>
							<Modal.Title>
								<T
									id={isEdit ? "object.edit" : "object.add"}
									tData={{ object: "certificates.custom" }}
								/>
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
										<T id="certificates.custom.warning" />
									</p>
									<Field
										name="niceName"
										validate={isEdit ? undefined : (value) => validateString(value, 1, 255)}
									>
										{({ field, meta }) => (
											<div className="mb-3">
												<label htmlFor="niceName" className="form-label">
													<T id="column.name" />
												</label>
												<input
													id="niceName"
													type="text"
													required
													autoComplete="off"
													// Disable name editing in edit mode as we only update files
													disabled={isEdit}
													className={cn("form-control", {
														"is-invalid": meta.touched && meta.error,
													})}
													{...field}
												/>

												<ErrorMessage
													name="niceName"
													component="div"
													className="invalid-feedback"
												/>
											</div>
										)}
									</Field>
									<Field name="certificate">
										{({ field, form }) => (
											<div className="mb-3">
												<label htmlFor="certificate" className="form-label">
													<T id="certificate.custom-certificate" />
												</label>
												<input
													id="certificate"
													type="file"
													required
													autoComplete="off"
													className="form-control"
													onChange={(event) => {
														form.setFieldValue(field.name, event.currentTarget.files[0]);
													}}
												/>
											</div>
										)}
									</Field>
									{!isMtls && (
										<Field name="certificateKey">
											{({ field, form }) => (
												<div className="mb-3">
													<label htmlFor="certificateKey" className="form-label">
														<T id="certificate.custom-certificate-key" />
													</label>
													<input
														id="certificateKey"
														type="file"
														required
														autoComplete="off"
														className="form-control"
														onChange={(event) => {
															form.setFieldValue(
																field.name,
																event.currentTarget.files[0],
															);
														}}
													/>
												</div>
											)}
										</Field>
									)}
								</div>
							</div>
						</Modal.Body>
						<Modal.Footer>
							<Button onClick={close}>
								<T id="cancel" />
							</Button>
							<Button type="submit" color="pink" className="ms-auto">
								<T id="save" />
							</Button>
						</Modal.Footer>
					</Form>
				)}
			</Formik>
		</Modal>
	);
});

export { showCustomCertificateModal };
