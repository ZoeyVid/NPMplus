import { useQueryClient } from "@tanstack/react-query";
import cn from "clsx";
import { Field, Form, Formik } from "formik";
import { useState } from "react";
import { Alert } from "react-bootstrap";
import Modal from "react-bootstrap/Modal";
import { createCertificate } from "src/api/backend";
import { Button, DNSProviderFields, DomainNamesField } from "src/components";
import { T } from "src/locale";
import EasyModal from "src/modules/easyModal";
import { showObjectSuccess } from "src/notifications";

const showDNSCertificateModal = () => {
	EasyModal.show(DNSCertificateModal);
};

const DNSCertificateModal = EasyModal.create(({ visible, remove }) => {
	const queryClient = useQueryClient();
	const [errorMsg, setErrorMsg] = useState(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const onSubmit = async (values, { setSubmitting }) => {
		if (isSubmitting) return;
		setIsSubmitting(true);
		setErrorMsg(null);

		try {
			await createCertificate(values);
			showObjectSuccess("certificate", "saved");
			remove();
		} catch (err) {
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
		}
		await queryClient.invalidateQueries({ queryKey: ["certificates"] });
		setIsSubmitting(false);
		setSubmitting(false);
	};

	const toggleClasses = "form-check-input";
	const toggleEnabled = cn(toggleClasses, "bg-cyan");

	return (
		<Modal show={visible} onHide={remove}>
			<Formik
				initialValues={{
					domainNames: [],
					provider: "letsencrypt",
					meta: {
						dnsChallenge: true,
						reuseKey: false,
					},
				}}
				onSubmit={onSubmit}
			>
				{() => (
					<Form>
						<Modal.Header closeButton>
							<Modal.Title>
								<T id="object.add" tData={{ object: "lets-encrypt-via-dns" }} />
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
								<div className="card-body">
									<DomainNamesField isWildcardPermitted dnsProviderWildcardSupported />
									<DNSProviderFields />
									<div className="row">
										<div className="col-6">
											<Field name="meta.reuseKey">
												{({ field }) => (
													<label className="form-check form-switch mt-1">
														<input
															{...field}
															className={field.value ? toggleEnabled : toggleClasses}
															type="checkbox"
															checked={field.value}
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
							<Button data-bs-dismiss="modal" onClick={remove} disabled={isSubmitting}>
								<T id="cancel" />
							</Button>
							<Button
								type="submit"
								actionType="primary"
								className="ms-auto bg-pink"
								data-bs-dismiss="modal"
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
