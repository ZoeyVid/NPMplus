import { ErrorMessage, Field, Form, Formik } from "formik";
import { useRef, useState } from "react";
import { Alert } from "react-bootstrap";
import Modal from "react-bootstrap/Modal";
import { deleteAvatar, uploadAvatar } from "src/api/backend";
import { Button, Loading } from "src/components";
import { useSetUser, useUser } from "src/hooks";
import { intl, T } from "src/locale";
import EasyModal from "src/modules/easyModal";
import { validateEmail, validateString } from "src/modules/Validations";
import { showObjectSuccess } from "src/notifications";

const showUserModal = (id) => {
	EasyModal.show(UserModal, { id });
};

const UserModal = EasyModal.create(({ id, visible, remove, close, formRef }) => {
	const { data, isPending, error } = useUser(id);
	const { data: currentUser, isPending: currentIsPending } = useUser("me");
	const { mutateAsync: setUser } = useSetUser();
	const [errorMsg, setErrorMsg] = useState(null);
	const fileInput = useRef(null);

	const changeAvatar = async (fn) => {
		setErrorMsg(null);
		try {
			await fn();
		} catch (err) {
			setErrorMsg(<T id={err.message} />);
		}
	};

	const onSubmit = async (values) => {
		setErrorMsg(null);

		const payload = {
			id: id === "new" ? undefined : id,
			...values,
		};

		if (data?.id === currentUser?.id) {
			// Prevent user from locking themselves out
			delete payload.npmplusIsAdmin;
			delete payload.isDisabled;
		}

		try {
			await setUser(payload);
			showObjectSuccess("user", "saved");
			remove();
		} catch (err) {
			setErrorMsg(<T id={err.message} />);
		}
	};

	return (
		<Modal show={visible} backdrop="static" onHide={close}>
			{error && (
				<Alert variant="danger" className="m-3">
					{error?.message}
				</Alert>
			)}
			{(isPending || currentIsPending) && <Loading noLogo />}
			{data && currentUser && (
				<Formik
					innerRef={formRef}
					initialValues={{
						name: data?.name,
						email: data?.email,
						npmplusIsAdmin: data?.npmplusIsAdmin,
						isDisabled: data?.isDisabled,
					}}
					onSubmit={onSubmit}
				>
					{({ isSubmitting }) => (
						<Form>
							<Modal.Header closeButton={!isSubmitting}>
								<Modal.Title>
									<T id={data?.id ? "object.edit" : "object.add"} tData={{ object: "user" }} />
								</Modal.Title>
							</Modal.Header>
							<Modal.Body>
								<Alert variant="danger" show={errorMsg} onClose={() => setErrorMsg(null)} dismissible>
									{errorMsg}
								</Alert>
								{id !== "new" && (
									<div className="d-flex align-items-center mb-3">
										<span
											className="avatar avatar-square avatar-lg me-3"
											style={{
												backgroundImage: `url(${data?.avatar})`,
											}}
										/>

										<input
											ref={fileInput}
											type="file"
											accept="image/png,image/jpeg,image/gif,image/webp"
											className="d-none"
											onChange={(e) => {
												const file = e.target.files?.[0];
												void changeAvatar(() => uploadAvatar(id, file));
												e.target.value = "";
											}}
										/>

										<Button className="me-2" onClick={() => fileInput.current?.click()}>
											<T id="avatar.upload" />
										</Button>
										{data?.avatar?.startsWith("/images/avatar/") && (
											<Button
												actionType="danger"
												variant="outline"
												onClick={() => changeAvatar(() => deleteAvatar(id))}
											>
												<T id="avatar.remove" />
											</Button>
										)}
									</div>
								)}
								<div className="mb-3">
									<Field name="name" validate={(value) => validateString(value, 1, 255)}>
										{({ field, meta }) => (
											<div className="form-floating mb-3">
												<input
													id="name"
													autoComplete="off"
													required
													className={`form-control ${meta.touched && meta.error ? "is-invalid" : ""}`}
													placeholder={intl.formatMessage({
														id: "user.full-name",
													})}
													{...field}
												/>

												<label htmlFor="name">
													<T id="user.full-name" />
												</label>
												<ErrorMessage
													name="name"
													component="div"
													className="invalid-feedback"
												/>
											</div>
										)}
									</Field>
								</div>
								<div className="mb-3">
									<Field name="email" validate={validateEmail}>
										{({ field, meta }) => (
											<div className="form-floating mb-3">
												<input
													id="email"
													type="email"
													autoComplete="off"
													required
													className={`form-control ${meta.touched && meta.error ? "is-invalid" : ""}`}
													placeholder={intl.formatMessage({
														id: "email-address",
													})}
													{...field}
												/>

												<label htmlFor="email">
													<T id="email-address" />
												</label>
												<ErrorMessage
													name="email"
													component="div"
													className="invalid-feedback"
												/>
											</div>
										)}
									</Field>
								</div>
								{currentUser?.id !== data?.id ? (
									<div className="my-3">
										<h4 className="py-2">
											<T id="options" />
										</h4>
										<div className="divide-y">
											<div>
												<label className="row cursor-pointer" htmlFor="npmplusIsAdmin">
													<span className="col">
														<T id="role.admin" />
													</span>
													<span className="col-auto">
														<Field name="npmplusIsAdmin" type="checkbox">
															{({ field }) => (
																<span className="form-check form-check-single form-switch">
																	<input
																		{...field}
																		id="npmplusIsAdmin"
																		className="form-check-input"
																		type="checkbox"
																	/>
																</span>
															)}
														</Field>
													</span>
												</label>
											</div>
											<div>
												<label className="row cursor-pointer" htmlFor="isDisabled">
													<span className="col">
														<T id="disabled" />
													</span>
													<span className="col-auto">
														<Field name="isDisabled" type="checkbox">
															{({ field }) => (
																<span className="form-check form-check-single form-switch">
																	<input
																		{...field}
																		id="isDisabled"
																		className="form-check-input"
																		type="checkbox"
																	/>
																</span>
															)}
														</Field>
													</span>
												</label>
											</div>
										</div>
									</div>
								) : null}
							</Modal.Body>
							<Modal.Footer>
								<Button onClick={close} disabled={isSubmitting}>
									<T id="cancel" />
								</Button>
								<Button
									type="submit"
									className="ms-auto btn-orange"
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

export { showUserModal };
