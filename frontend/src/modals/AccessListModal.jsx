import cn from "clsx";
import { Field, Form, Formik } from "formik";
import { useState } from "react";
import { Alert } from "react-bootstrap";
import Modal from "react-bootstrap/Modal";
import { AccessClientFields, BasicAuthFields, Button, Loading } from "src/components";
import { useAccessList, useSetAccessList } from "src/hooks";
import { intl, T } from "src/locale";
import EasyModal from "src/modules/easyModal";
import { showTabOfInvalid, validateString } from "src/modules/Validations";
import { showObjectSuccess } from "src/notifications";

const showAccessListModal = (id) => {
	EasyModal.show(AccessListModal, { id });
};

const AccessListModal = EasyModal.create(({ id, visible, remove }) => {
	const { data, isLoading, error } = useAccessList(id, ["items", "clients"]);
	const { mutate: setAccessList } = useSetAccessList();
	const [errorMsg, setErrorMsg] = useState(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const validate = (values) => {
		// either Auths or Clients must be defined
		if (values.items?.length === 0 && values.clients?.length === 0) {
			return intl.formatMessage({ id: "error.access.at-least-one" });
		}

		// ensure the items don't contain the same username twice
		const usernames = values.items.map((i) => i.username);
		const uniqueUsernames = Array.from(new Set(usernames));
		if (usernames.length !== uniqueUsernames.length) {
			return intl.formatMessage({ id: "error.access.duplicate-usernames" });
		}

		return null;
	};

	const onSubmit = (values, { setSubmitting }) => {
		if (isSubmitting) return;

		const vErr = validate(values);
		if (vErr) {
			setErrorMsg(vErr);
			return;
		}

		setIsSubmitting(true);
		setErrorMsg(null);

		const { ...payload } = {
			id: id === "new" ? undefined : id,
			...values,
			name: values.name.trim(),
		};

		// Filter out "items" to only use the "username" and "password" fields
		payload.items = (values.items || []).map((i) => ({
			username: i.username,
			password: i.password,
		}));

		// Filter out "clients" to only use the "directive" and "address" fields
		payload.clients = (values.clients || []).map((i) => ({
			directive: i.directive,
			address: i.address.trim(),
		}));

		setAccessList(payload, {
			onError: (err) => setErrorMsg(<T id={err.message} />),
			onSuccess: () => {
				showObjectSuccess("access-list", "saved");
				remove();
			},
			onSettled: () => {
				setIsSubmitting(false);
				setSubmitting(false);
			},
		});
	};

	const toggleClasses = "form-check-input";
	const toggleEnabled = cn(toggleClasses, "bg-cyan");

	return (
		<Modal show={visible} onHide={remove}>
			{!isLoading && error && (
				<Alert variant="danger" className="m-3">
					{error?.message || "Unknown error"}
				</Alert>
			)}
			{isLoading && <Loading noLogo />}
			{!isLoading && data && (
				<Formik
					initialValues={{
						name: data?.name,
						satisfyAny: data?.satisfyAny,
						passAuth: data?.passAuth,
						items: data?.items || [],
						clients: data?.clients || [],
					}}
					onSubmit={onSubmit}
				>
					{({ setFieldValue }) => (
						<Form onInvalid={showTabOfInvalid}>
							<Modal.Header closeButton>
								<Modal.Title>
									<T id={data?.id ? "object.edit" : "object.add"} tData={{ object: "access-list" }} />
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
													href="#tab-auth"
													className="nav-link"
													data-bs-toggle="tab"
													aria-selected="false"
													tabIndex={-1}
													role="tab"
												>
													<T id="column.authorizations" />
												</a>
											</li>
											<li className="nav-item" role="presentation">
												<a
													href="#tab-rules"
													className="nav-link"
													data-bs-toggle="tab"
													aria-selected="false"
													tabIndex={-1}
													role="tab"
												>
													<T id="column.rules" />
												</a>
											</li>
										</ul>
									</div>
									<div className="card-body">
										<div className="tab-content">
											<div className="tab-pane active show" id="tab-details" role="tabpanel">
												<Field name="name" validate={validateString(1, 255)}>
													{({ field, form }) => (
														<div>
															<label htmlFor="name" className="form-label">
																<T id="column.name" />
															</label>
															<input
																id="name"
																type="text"
																required
																autoComplete="off"
																className="form-control"
																{...field}
															/>

															{form.errors.name ? (
																<div className="invalid-feedback">
																	{form.errors.name && form.touched.name
																		? form.errors.name
																		: null}
																</div>
															) : null}
														</div>
													)}
												</Field>
												<div className="my-3">
													<h3 className="py-2">
														<T id="options" />
													</h3>
													<div className="divide-y">
														<div>
															<label className="row cursor-pointer" htmlFor="satisfyAny">
																<span className="col">
																	<T id="access-list.satisfy-any" />
																</span>
																<span className="col-auto">
																	<Field name="satisfyAny" type="checkbox">
																		{({ field }) => (
																			<span className="form-check form-check-single form-switch">
																				<input
																					id="satisfyAny"
																					className={
																						field.value
																							? toggleEnabled
																							: toggleClasses
																					}
																					type="checkbox"
																					name={field.name}
																					checked={field.value}
																					onChange={(e) => {
																						setFieldValue(
																							field.name,
																							e.target.checked,
																						);
																					}}
																				/>
																			</span>
																		)}
																	</Field>
																</span>
															</label>
														</div>
														<div>
															<label className="row cursor-pointer" htmlFor="passAuth">
																<span className="col">
																	<T id="access-list.pass-auth" />
																</span>
																<span className="col-auto">
																	<Field name="passAuth" type="checkbox">
																		{({ field }) => (
																			<span className="form-check form-check-single form-switch">
																				<input
																					id="passAuth"
																					className={
																						field.value
																							? toggleEnabled
																							: toggleClasses
																					}
																					type="checkbox"
																					name={field.name}
																					checked={field.value}
																					onChange={(e) => {
																						setFieldValue(
																							field.name,
																							e.target.checked,
																						);
																					}}
																				/>
																			</span>
																		)}
																	</Field>
																</span>
															</label>
														</div>
													</div>
												</div>
											</div>
											<div className="tab-pane" id="tab-auth" role="tabpanel">
												<BasicAuthFields initialValues={data?.items || []} />
											</div>
											<div className="tab-pane" id="tab-rules" role="tabpanel">
												<AccessClientFields initialValues={data?.clients || []} />
											</div>
										</div>
									</div>
								</div>
							</Modal.Body>
							<Modal.Footer>
								<Button onClick={remove} disabled={isSubmitting}>
									<T id="cancel" />
								</Button>
								<Button
									type="submit"
									actionType="primary"
									className="ms-auto bg-cyan"
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

export { showAccessListModal };
