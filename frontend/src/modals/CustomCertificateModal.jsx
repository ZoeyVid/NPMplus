import { IconAlertTriangle } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { Field, Form, Formik } from "formik";
import { useState } from "react";
import { Alert } from "react-bootstrap";
import Modal from "react-bootstrap/Modal";
import { createCertificate, uploadCertificate, validateCertificate } from "src/api/backend";
import { Button } from "src/components";
import { T } from "src/locale";
import EasyModal from "src/modules/easyModal";
import { validateString } from "src/modules/Validations";
import { showObjectSuccess } from "src/notifications";

const showCustomCertificateModal = (cert, provider) => {
	EasyModal.show(CustomCertificateModal, { cert, provider });
};

const CustomCertificateModal = EasyModal.create(({ visible, remove, cert, provider = "other" }) => {
	const queryClient = useQueryClient();
	const [errorMsg, setErrorMsg] = useState(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const isEdit = Boolean(cert);
	const isMtls = (cert?.provider ?? provider) === "mtls";

	const onSubmit = async (values, { setSubmitting }) => {
		if (isSubmitting) return;
		setIsSubmitting(true);
		setErrorMsg(null);

		try {
			const { niceName, certificate, certificateKey } = values;
			const formData = new FormData();

			formData.append("certificate", certificate);
			if (!isMtls) {
				formData.append("certificate_key", certificateKey);
			}

			// Validate
			await validateCertificate(formData);

			if (isEdit) {
				// Upload the certificates to the exiting certificate
				await uploadCertificate(cert.id, formData);
			} else {
				// Create certificate with the specified provider
				const newCert = await createCertificate({
					niceName,
					provider,
				});

				// Upload the certificates to the created certificate
				await uploadCertificate(newCert.id, formData);
			}

			// Success
			showObjectSuccess("certificate", "saved");
			remove();
		} catch (err) {
			setErrorMsg(<T id={err.message} />);
		}

		await queryClient.invalidateQueries({ queryKey: ["certificates"] });
		setIsSubmitting(false);
		setSubmitting(false);
	};

	return (
		<Modal show={visible} onHide={isSubmitting ? undefined : remove}>
			<Formik
				initialValues={{
					niceName: cert?.niceName || "",

					certificate: null,
					certificateKey: null,
				}}
				onSubmit={onSubmit}
			>
				{() => (
					<Form>
						<Modal.Header closeButton={!isSubmitting}>
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
									<Field name="niceName" validate={isEdit ? undefined : validateString(1, 255)}>
										{({ field, form }) => (
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
													className={`form-control ${form.errors.niceName && form.touched.niceName ? "is-invalid" : ""}`}
													{...field}
												/>

												{form.errors.niceName ? (
													<div className="invalid-feedback">
														{form.touched.niceName ? form.errors.niceName : null}
													</div>
												) : null}
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
							<Button onClick={remove} disabled={isSubmitting}>
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

export { showCustomCertificateModal };
