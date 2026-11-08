import cn from "clsx";
import { ErrorMessage, Field, Form, Formik } from "formik";
import { useState } from "react";
import { Alert } from "react-bootstrap";
import Modal from "react-bootstrap/Modal";
import { AccessClientFields, BasicAuthFields, Button, Loading, toClientRows, toItemRows } from "src/components";
import { useAccessList, useSetAccessList, useUser } from "src/hooks";
import { intl, T } from "src/locale";
import EasyModal from "src/modules/easyModal";
import { initTabs } from "src/modules/Focus";
import { ACCESS_LISTS, hasPermission, MANAGE } from "src/modules/Permissions";
import { showTabOfInvalid, validateString } from "src/modules/Validations";
import { showObjectSuccess } from "src/notifications";

const showAccessListModal = (id) => {
	EasyModal.show(AccessListModal, { id });
};

const AccessListModal = EasyModal.create(({ id, visible, remove, close, formRef }) => {
	const { data, isPending, error } = useAccessList(id);
	const { mutateAsync: setAccessList } = useSetAccessList();
	const { data: currentUser } = useUser("me");
	const canManage = hasPermission(ACCESS_LISTS, MANAGE, currentUser?.permissions, currentUser?.npmplusIsAdmin);
	const [errorMsg, setErrorMsg] = useState(null);

	const validate = (values) => {
		// either Auths or Clients must be defined
		if (values.items.length === 0 && values.clients.every((c) => c.address.trim().toLowerCase() === "all")) {
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

	const onSubmit = async (values) => {
		const items = values.items.filter(({ username }) => username.trim());
		const clients = values.clients.filter(({ address }) => address.trim());

		const vErr = validate({ ...values, items, clients });
		if (vErr) {
			setErrorMsg(vErr);
			return;
		}

		setErrorMsg(null);

		const payload = {
			id: id === "new" ? undefined : id,
			...values,
		};

		// Filter out "items" to only use the "username" and "password" fields
		payload.items = items.map((i) => ({
			username: i.username,
			password: i.password,
		}));

		// Filter out "clients" to only use the "directive" and "address" fields
		payload.clients = clients.map((i) => ({
			directive: i.directive,
			address: i.address,
		}));

		try {
			await setAccessList(payload);
			showObjectSuccess("access-list", "saved");
			remove();
		} catch (err) {
			setErrorMsg(<T id={err.message} />);
		}
	};

	return (
		<Modal show={visible} backdrop={canManage ? "static" : true} onHide={close}>
			<Modal.Header closeButton>
				<Modal.Title>
					<T id={id !== "new" ? "object.edit" : "object.add"} tData={{ object: "access-list" }} />
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
						name: data?.name,
						satisfyAny: data?.satisfyAny,
						passAuth: data?.passAuth,
						items: toItemRows(data?.items),
						clients: toClientRows(data?.clients),
					}}
					onSubmit={onSubmit}
				>
					{({ isSubmitting }) => (
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
												<a href="#tab-auth" className="nav-link" data-bs-toggle="tab">
													<T id="column.authorizations" />
												</a>
											</li>
											<li className="nav-item">
												<a href="#tab-rules" className="nav-link" data-bs-toggle="tab">
													<T id="column.rules" />
												</a>
											</li>
										</ul>
									</div>
									<div className="card-body">
										<fieldset className="tab-content" disabled={!canManage}>
											<div className="tab-pane active show" id="tab-details">
												<Field name="name" validate={(value) => validateString(value, 1, 255)}>
													{({ field, meta }) => (
														<div>
															<label htmlFor="name" className="form-label">
																<T id="column.name" />
															</label>
															<input
																id="name"
																type="text"
																required
																autoComplete="off"
																className={`form-control ${meta.touched && meta.error ? "is-invalid" : ""}`}
																{...field}
															/>

															<ErrorMessage
																name="name"
																component="div"
																className="invalid-feedback"
															/>
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
																					{...field}
																					id="satisfyAny"
																					className={cn("form-check-input", {
																						"bg-cyan": field.checked,
																					})}
																					type="checkbox"
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
																					{...field}
																					id="passAuth"
																					className={cn("form-check-input", {
																						"bg-cyan": field.checked,
																					})}
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
											</div>
											<div className="tab-pane" id="tab-auth">
												<BasicAuthFields />
											</div>
											<div className="tab-pane" id="tab-rules">
												<AccessClientFields />
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
										color="cyan"
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

export { showAccessListModal };
