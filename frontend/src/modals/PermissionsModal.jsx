import { useQueryClient } from "@tanstack/react-query";
import cn from "clsx";
import { Field, Form, Formik } from "formik";
import { useState } from "react";
import { Alert } from "react-bootstrap";
import Modal from "react-bootstrap/Modal";
import { setPermissions } from "src/api/backend";
import { Button, Loading } from "src/components";
import { useUser } from "src/hooks";
import { T } from "src/locale";
import EasyModal from "src/modules/easyModal";
import { isAdmin } from "src/modules/Permissions";
import styles from "./PermissionsModal.module.css";

const showPermissionsModal = (id) => {
	EasyModal.show(PermissionsModal, { id });
};

const PermissionsModal = EasyModal.create(({ id, visible, remove }) => {
	const queryClient = useQueryClient();
	const [errorMsg, setErrorMsg] = useState(null);
	const { data, isLoading, error } = useUser(id);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const onSubmit = async (values, { setSubmitting }) => {
		if (isSubmitting) return;
		setIsSubmitting(true);
		setErrorMsg(null);
		try {
			await setPermissions(id, values);
			remove();
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: ["users"] }),
				queryClient.invalidateQueries({ queryKey: ["user"] }),
			]);
		} catch (err) {
			setErrorMsg(<T id={err.message} />);
		}
		setSubmitting(false);
		setIsSubmitting(false);
	};

	const getClasses = (active) =>
		cn("btn", active ? styles.active : null, {
			active,
			"bg-orange-lt": active,
		});

	// given the field and clicked permission, intelligently set the value, and
	// other values that depends on it.
	const handleChange = (form, field, perm) => {
		if (field.name === "proxyHosts" && perm !== "hidden" && form.values.accessLists === "hidden") {
			form.setFieldValue("accessLists", "view");
		}
		// certs are required for proxy and redirection hosts, and streams
		if (
			["proxyHosts", "redirectionHosts", "deadHosts", "streams"].includes(field.name) &&
			perm !== "hidden" &&
			form.values.certificates === "hidden"
		) {
			form.setFieldValue("certificates", "view");
		}

		form.setFieldValue(field.name, perm);
	};

	const getPermissionButtons = (field, form) => {
		const isManage = field.value === "manage";
		const isView = field.value === "view";
		const isHidden = field.value === "hidden";

		let hiddenDisabled = false;
		if (field.name === "accessLists") {
			hiddenDisabled = form.values.proxyHosts !== "hidden";
		}
		if (field.name === "certificates") {
			hiddenDisabled =
				form.values.proxyHosts !== "hidden" ||
				form.values.redirectionHosts !== "hidden" ||
				form.values.deadHosts !== "hidden" ||
				form.values.streams !== "hidden";
		}

		return (
			<div>
				<fieldset className="btn-group w-100">
					<input
						type="radio"
						className="btn-check"
						name="btn-radio-basic"
						id={`${field.name}-manage`}
						autoComplete="off"
						value="manage"
						checked={field.value === "manage"}
						onChange={() => handleChange(form, field, "manage")}
					/>

					<label htmlFor={`${field.name}-manage`} className={getClasses(isManage)}>
						<T id="permissions.manage" />
					</label>
					<input
						type="radio"
						className="btn-check"
						name="btn-radio-basic"
						id={`${field.name}-view`}
						autoComplete="off"
						value="view"
						checked={field.value === "view"}
						onChange={() => handleChange(form, field, "view")}
					/>

					<label htmlFor={`${field.name}-view`} className={getClasses(isView)}>
						<T id="permissions.view" />
					</label>
					<input
						type="radio"
						className="btn-check"
						name="btn-radio-basic"
						id={`${field.name}-hidden`}
						autoComplete="off"
						value="hidden"
						checked={field.value === "hidden"}
						disabled={hiddenDisabled}
						onChange={() => handleChange(form, field, "hidden")}
					/>

					<label htmlFor={`${field.name}-hidden`} className={getClasses(isHidden)}>
						<T id="permissions.hidden" />
					</label>
				</fieldset>
			</div>
		);
	};

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
						visibility: data.permissions?.visibility,
						accessLists: data.permissions?.accessLists,
						certificates: data.permissions?.certificates,
						deadHosts: data.permissions?.deadHosts,
						proxyHosts: data.permissions?.proxyHosts,
						redirectionHosts: data.permissions?.redirectionHosts,
						streams: data.permissions?.streams,
					}}
					onSubmit={onSubmit}
				>
					{() => (
						<Form>
							<Modal.Header closeButton>
								<Modal.Title>
									<T id="user.set-permissions" data={{ name: data?.name }} />
								</Modal.Title>
							</Modal.Header>
							<Modal.Body>
								<Alert
									variant="danger"
									show={Boolean(errorMsg)}
									onClose={() => setErrorMsg(null)}
									dismissible
								>
									{errorMsg}
								</Alert>
								<div className="mb-3">
									<div className="form-label">
										<T id="permissions.visibility.title" />
									</div>
									<Field name="visibility">
										{({ field, form }) => (
											<fieldset className="btn-group w-100">
												<input
													type="radio"
													className="btn-check"
													name="btn-radio-basic"
													id={`${field.name}-user`}
													autoComplete="off"
													value="user"
													checked={field.value === "user"}
													onChange={() => form.setFieldValue(field.name, "user")}
												/>

												<label
													htmlFor={`${field.name}-user`}
													className={getClasses(field.value === "user")}
												>
													<T id="permissions.visibility.user" />
												</label>
												<input
													type="radio"
													className="btn-check"
													name="btn-radio-basic"
													id={`${field.name}-all`}
													autoComplete="off"
													value="all"
													checked={field.value === "all"}
													onChange={() => form.setFieldValue(field.name, "all")}
												/>

												<label
													htmlFor={`${field.name}-all`}
													className={getClasses(field.value === "all")}
												>
													<T id="permissions.visibility.all" />
												</label>
											</fieldset>
										)}
									</Field>
								</div>
								{!isAdmin(data?.roles) && (
									<>
										<div className="mb-3">
											<div className="form-label">
												<T id="proxy-hosts" />
											</div>
											<Field name="proxyHosts">
												{({ field, form }) => getPermissionButtons(field, form)}
											</Field>
										</div>
										<div className="mb-3">
											<div className="form-label">
												<T id="redirection-hosts" />
											</div>
											<Field name="redirectionHosts">
												{({ field, form }) => getPermissionButtons(field, form)}
											</Field>
										</div>
										<div className="mb-3">
											<div className="form-label">
												<T id="dead-hosts" />
											</div>
											<Field name="deadHosts">
												{({ field, form }) => getPermissionButtons(field, form)}
											</Field>
										</div>
										<div className="mb-3">
											<div className="form-label">
												<T id="streams" />
											</div>
											<Field name="streams">
												{({ field, form }) => getPermissionButtons(field, form)}
											</Field>
										</div>
										<div className="mb-3">
											<div className="form-label">
												<T id="access-lists" />
											</div>
											<Field name="accessLists">
												{({ field, form }) => getPermissionButtons(field, form)}
											</Field>
										</div>
										<div className="mb-3">
											<div className="form-label">
												<T id="certificates" />
											</div>
											<Field name="certificates">
												{({ field, form }) => getPermissionButtons(field, form)}
											</Field>
										</div>
									</>
								)}
							</Modal.Body>
							<Modal.Footer>
								<Button onClick={remove} disabled={isSubmitting}>
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

export { showPermissionsModal };
