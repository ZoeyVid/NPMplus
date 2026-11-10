import { ErrorMessage, Field, Form, Formik } from "formik";
import { useState } from "react";
import { Alert } from "react-bootstrap";
import { Button, Loading } from "src/components";
import { useSetSetting, useSetting } from "src/hooks";
import { intl, T } from "src/locale";
import { validateString } from "src/modules/Validations";
import { showObjectSuccess } from "src/notifications";

export default function DefaultSite() {
	const { data, isPending, error } = useSetting("default-site");
	const { mutateAsync: setSetting } = useSetSetting();
	const [errorMsg, setErrorMsg] = useState(null);

	const onSubmit = async (values) => {
		setErrorMsg(null);

		const payload = {
			id: "default-site",
			value: values.value,
			meta: {
				redirect: values.value === "redirect" ? values.redirect : undefined,
				html: values.value === "html" ? values.html : undefined,
				status: (values.value === "html" && values.status) || undefined,
			},
		};

		try {
			await setSetting(payload);
			showObjectSuccess("setting", "saved");
		} catch (err) {
			setErrorMsg(<T id={err.message} />);
		}
	};

	if (error) {
		return (
			<div className="card-body">
				<div className="mb-3">
					<Alert variant="danger" show>
						{error.message}
					</Alert>
				</div>
			</div>
		);
	}

	if (isPending) {
		return (
			<div className="card-body">
				<div className="mb-3">
					<Loading noLogo />
				</div>
			</div>
		);
	}

	return (
		<Formik
			initialValues={{
				value: data?.value,
				redirect: data?.meta?.redirect || "",
				html: data?.meta?.html || "",
				status: data?.meta?.status || "",
			}}
			onSubmit={onSubmit}
		>
			{({ values }) => (
				<Form>
					<div className="card-body">
						<Alert variant="danger" show={errorMsg} onClose={() => setErrorMsg(null)} dismissible>
							{errorMsg}
						</Alert>
						<Field name="value">
							{({ field, form }) => (
								<div className="mb-3">
									<div className="form-label">
										<T id="settings.default-site.description" />
									</div>
									<div className="form-selectgroup form-selectgroup-boxes d-flex flex-column">
										<label className="form-selectgroup-item flex-fill">
											<input
												type="radio"
												name={field.name}
												value="congratulations"
												className="form-selectgroup-input"
												checked={field.value === "congratulations"}
												onChange={(e) => form.setFieldValue(field.name, e.target.value)}
											/>

											<div className="form-selectgroup-label d-flex align-items-center p-3">
												<div className="me-3">
													<span className="form-selectgroup-check" />
												</div>
												<div>
													<T id="settings.default-site.congratulations" />
												</div>
											</div>
										</label>
										<label className="form-selectgroup-item flex-fill">
											<input
												type="radio"
												name={field.name}
												value="404"
												className="form-selectgroup-input"
												checked={field.value === "404"}
												onChange={(e) => form.setFieldValue(field.name, e.target.value)}
											/>

											<div className="form-selectgroup-label d-flex align-items-center p-3">
												<div className="me-3">
													<span className="form-selectgroup-check" />
												</div>
												<div>
													<T id="settings.default-site.404" />
												</div>
											</div>
										</label>
										<label className="form-selectgroup-item flex-fill">
											<input
												type="radio"
												name={field.name}
												value="444"
												className="form-selectgroup-input"
												checked={field.value === "444"}
												onChange={(e) => form.setFieldValue(field.name, e.target.value)}
											/>

											<div className="form-selectgroup-label d-flex align-items-center p-3">
												<div className="me-3">
													<span className="form-selectgroup-check" />
												</div>
												<div>
													<T id="settings.default-site.444" />
												</div>
											</div>
										</label>
										<label className="form-selectgroup-item flex-fill">
											<input
												type="radio"
												name={field.name}
												value="redirect"
												className="form-selectgroup-input"
												checked={field.value === "redirect"}
												onChange={(e) => form.setFieldValue(field.name, e.target.value)}
											/>

											<div className="form-selectgroup-label d-flex align-items-center p-3">
												<div className="me-3">
													<span className="form-selectgroup-check" />
												</div>
												<div>
													<T id="settings.default-site.redirect" />
												</div>
											</div>
										</label>
										<label className="form-selectgroup-item flex-fill">
											<input
												type="radio"
												name={field.name}
												value="html"
												className="form-selectgroup-input"
												checked={field.value === "html"}
												onChange={(e) => form.setFieldValue(field.name, e.target.value)}
											/>

											<div className="form-selectgroup-label d-flex align-items-center p-3">
												<div className="me-3">
													<span className="form-selectgroup-check" />
												</div>
												<div>
													<T id="settings.default-site.html" />
												</div>
											</div>
										</label>
									</div>
								</div>
							)}
						</Field>
						{values.value === "redirect" && (
							<Field name="redirect" validate={(value) => validateString(value, 1, 255)}>
								{({ field, meta }) => (
									<div className="mt-5 mb-3">
										<label className="form-label" htmlFor="redirect">
											<T id="settings.default-site.redirect" />
										</label>
										<div>
											<input
												id="redirect"
												type="text"
												placeholder="https://"
												required
												pattern="\S+"
												autoComplete="off"
												className={`form-control ${meta.touched && meta.error ? "is-invalid" : ""}`}
												{...field}
											/>

											<ErrorMessage
												name="redirect"
												component="div"
												className="invalid-feedback"
											/>
										</div>
									</div>
								)}
							</Field>
						)}
						{values.value === "html" && (
							<>
								<Field name="html">
									{({ field }) => (
										<div className="mt-5 mb-3">
											<label className="form-label" htmlFor="html">
												<T id="settings.default-site.html" />
											</label>
											<div>
												<textarea
													id="html"
													required
													className="form-control font-monospace"
													spellCheck={false}
													placeholder={intl.formatMessage({
														id: "settings.default-site.html.placeholder",
													})}
													rows={14}
													{...field}
												/>
											</div>
										</div>
									)}
								</Field>
								<Field name="status">
									{({ field }) => (
										<div className="mb-3">
											<label className="form-label" htmlFor="status">
												<T id="settings.default-site.status" />
											</label>
											<input
												id="status"
												type="number"
												min={400}
												max={599}
												placeholder="200"
												autoComplete="off"
												className="form-control"
												{...field}
											/>
										</div>
									)}
								</Field>
							</>
						)}
					</div>
					<div className="card-footer bg-transparent mt-auto">
						<div className="btn-list justify-content-end">
							<Button type="submit" color="teal" className="ms-auto">
								<T id="save" />
							</Button>
						</div>
					</div>
				</Form>
			)}
		</Formik>
	);
}
