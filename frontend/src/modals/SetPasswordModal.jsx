import { IconEye, IconEyeOff } from "@tabler/icons-react";
import { ErrorMessage, Field, Form, Formik } from "formik";
import { useState } from "react";
import { Alert } from "react-bootstrap";
import Modal from "react-bootstrap/Modal";
import { updateAuth } from "src/api/backend";
import { Button } from "src/components";
import { intl, T } from "src/locale";
import EasyModal from "src/modules/easyModal";
import { validateString } from "src/modules/Validations";
import { showObjectSuccess } from "src/notifications";

const showSetPasswordModal = (id) => {
	EasyModal.show(SetPasswordModal, { id });
};

const SetPasswordModal = EasyModal.create(({ id, visible, remove, close, formRef }) => {
	const [error, setError] = useState(null);
	const [showPassword, setShowPassword] = useState(false);

	const onSubmit = async (values) => {
		setError(null);
		try {
			await updateAuth(id, values.new);
			showObjectSuccess("user", "updated");
			remove();
		} catch (err) {
			setError(<T id={err.message} />);
		}
	};

	return (
		<Modal show={visible} backdrop="static" onHide={close}>
			<Formik
				innerRef={formRef}
				initialValues={{
					new: "",
				}}
				onSubmit={onSubmit}
			>
				{({ isSubmitting }) => (
					<Form>
						<Modal.Header closeButton={!isSubmitting}>
							<Modal.Title>
								<T id="user.set-password" />
							</Modal.Title>
						</Modal.Header>
						<Modal.Body>
							<Alert variant="danger" show={error} onClose={() => setError(null)} dismissible>
								{error}
							</Alert>
							<Alert variant="warning">
								<T id="logout-other-devices" />
							</Alert>
							<div className="mb-3">
								<Field name="new" validate={(value) => validateString(value, 8, 255, false)}>
									{({ field, meta }) => (
										<div className="input-group input-group-flat">
											<div className="form-floating">
												<input
													id="new"
													type={showPassword ? "text" : "password"}
													autoComplete="new-password"
													required
													className={`form-control ${meta.touched && meta.error ? "is-invalid" : ""}`}
													placeholder={intl.formatMessage({
														id: "user.new-password",
													})}
													{...field}
												/>

												<label htmlFor="new">
													<T id="user.new-password" />
												</label>
											</div>
											<span className="input-group-text">
												<button
													type="button"
													title={intl.formatMessage({
														id: showPassword ? "password.hide" : "password.show",
													})}
													onMouseDown={(e) => e.preventDefault()}
													className="p-0 border-0 bg-transparent text-secondary d-flex align-items-center cursor-pointer"
													onClick={() => setShowPassword((v) => !v)}
												>
													{showPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
												</button>
											</span>
										</div>
									)}
								</Field>
								<ErrorMessage name="new" component="div" className="invalid-feedback d-block" />
							</div>
						</Modal.Body>
						<Modal.Footer>
							<Button onClick={close}>
								<T id="cancel" />
							</Button>
							<Button type="submit" actionType="primary" className="ms-auto">
								<T id="save" />
							</Button>
						</Modal.Footer>
					</Form>
				)}
			</Formik>
		</Modal>
	);
});

export { showSetPasswordModal };
