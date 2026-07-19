import EasyModal, { type InnerModalProps } from "src/modules/easyModal";
import { IconEye, IconEyeOff } from "@tabler/icons-react";
import { ErrorMessage, Field, Form, Formik } from "formik";
import { type ReactNode, useState } from "react";
import { Alert } from "react-bootstrap";
import Modal from "react-bootstrap/Modal";
import { updateAuth } from "src/api/backend";
import { Button } from "src/components";
import { intl, T } from "src/locale";
import { validateString } from "src/modules/Validations";

const showChangePasswordModal = (id: number | "me") => {
	EasyModal.show(ChangePasswordModal, { id });
};

interface Props extends InnerModalProps {
	id: number | "me";
}
const ChangePasswordModal = EasyModal.create(({ id, visible, remove }: Props) => {
	const [error, setError] = useState<ReactNode | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [showCurrent, setShowCurrent] = useState(false);
	const [showNew, setShowNew] = useState(false);
	const [showConfirm, setShowConfirm] = useState(false);

	const onSubmit = async (values: any, { setSubmitting }: any) => {
		if (values.new !== values.confirm) {
			setError(<T id="error.passwords-must-match" />);
			setSubmitting(false);
			return;
		}

		if (isSubmitting) return;
		setIsSubmitting(true);
		setError(null);

		try {
			await updateAuth(id, values.new, values.current);
			remove();
		} catch (err: any) {
			setError(<T id={err.message} />);
		}
		setIsSubmitting(false);
		setSubmitting(false);
	};

	return (
		<Modal show={visible} onHide={remove}>
			<Formik
				initialValues={
					{
						current: "",
						new: "",
						confirm: "",
					} as any
				}
				onSubmit={onSubmit}
			>
				{() => (
					<Form>
						<Modal.Header closeButton>
							<Modal.Title>
								<T id="user.change-password" />
							</Modal.Title>
						</Modal.Header>
						<Modal.Body>
							<Alert variant="danger" show={!!error} onClose={() => setError(null)} dismissible>
								{error}
							</Alert>
							<div className="mb-3">
								<Field name="current">
									{({ field, form }: any) => (
										<div className="input-group input-group-flat">
											<div className="form-floating">
												<input
													id="current"
													type={showCurrent ? "text" : "password"}
													autoComplete="current-password"
													required
													className={`form-control ${form.errors.current && form.touched.current ? "is-invalid" : ""}`}
													placeholder={intl.formatMessage({
														id: "user.current-password",
													})}
													{...field}
												/>
												<label htmlFor="current">
													<T id="user.current-password" />
												</label>
											</div>
											<span className="input-group-text">
												<button
													type="button"
													tabIndex={-1}
													aria-label="toggle visibility"
													className="p-0 border-0 bg-transparent text-secondary d-flex align-items-center cursor-pointer"
													onClick={() => setShowCurrent((v) => !v)}
												>
													{showCurrent ? <IconEyeOff size={18} /> : <IconEye size={18} />}
												</button>
											</span>
										</div>
									)}
								</Field>
								<ErrorMessage name="current" component="div" className="invalid-feedback d-block" />
							</div>
							<div className="mb-3">
								<Field name="new" validate={validateString(8, 100)}>
									{({ field, form }: any) => (
										<div className="input-group input-group-flat">
											<div className="form-floating">
												<input
													id="new"
													type={showNew ? "text" : "password"}
													autoComplete="new-password"
													required
													className={`form-control ${form.errors.new && form.touched.new ? "is-invalid" : ""}`}
													placeholder={intl.formatMessage({ id: "user.new-password" })}
													{...field}
												/>
												<label htmlFor="new">
													<T id="user.new-password" />
												</label>
											</div>
											<span className="input-group-text">
												<button
													type="button"
													tabIndex={-1}
													aria-label="toggle visibility"
													className="p-0 border-0 bg-transparent text-secondary d-flex align-items-center cursor-pointer"
													onClick={() => setShowNew((v) => !v)}
												>
													{showNew ? <IconEyeOff size={18} /> : <IconEye size={18} />}
												</button>
											</span>
										</div>
									)}
								</Field>
								<ErrorMessage name="new" component="div" className="invalid-feedback d-block" />
							</div>
							<div className="mb-3">
								<Field name="confirm" validate={validateString(8, 100)}>
									{({ field, form }: any) => (
										<div className="input-group input-group-flat">
											<div className="form-floating">
												<input
													id="confirm"
													type={showConfirm ? "text" : "password"}
													autoComplete="new-password"
													required
													className={`form-control ${form.errors.confirm && form.touched.confirm ? "is-invalid" : ""}`}
													placeholder={intl.formatMessage({ id: "user.confirm-password" })}
													{...field}
												/>
												<label htmlFor="confirm">
													<T id="user.confirm-password" />
												</label>
											</div>
											<span className="input-group-text">
												<button
													type="button"
													tabIndex={-1}
													aria-label="toggle visibility"
													className="p-0 border-0 bg-transparent text-secondary d-flex align-items-center cursor-pointer"
													onClick={() => setShowConfirm((v) => !v)}
												>
													{showConfirm ? <IconEyeOff size={18} /> : <IconEye size={18} />}
												</button>
											</span>
										</div>
									)}
								</Field>
								<ErrorMessage name="confirm" component="div" className="invalid-feedback d-block" />
							</div>
						</Modal.Body>
						<Modal.Footer>
							<Button data-bs-dismiss="modal" onClick={remove} disabled={isSubmitting}>
								<T id="cancel" />
							</Button>
							<Button
								type="submit"
								actionType="primary"
								className="ms-auto"
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

export { showChangePasswordModal };
