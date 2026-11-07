import { IconEye, IconEyeOff } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { ErrorMessage, Field, Form, Formik } from "formik";
import { useState } from "react";
import { Alert } from "react-bootstrap";
import { createSetupUser } from "src/api/backend";
import { Button, LocalePicker, Page, ThemeSwitcher } from "src/components";
import { useAuthState } from "src/context";
import { useHealth } from "src/hooks";
import { intl, T } from "src/locale";
import { validateEmail, validateString } from "src/modules/Validations";

export default function Setup() {
	const queryClient = useQueryClient();
	const { login } = useAuthState();
	const health = useHealth();
	const [errorMsg, setErrorMsg] = useState(null);
	const [showPassword, setShowPassword] = useState(false);

	const onSubmit = async (values) => {
		setErrorMsg(null);

		const { password, ...payload } = {
			...values,
			auth: {
				type: "password",
				secret: values.password,
			},
		};

		try {
			const user = await createSetupUser(payload);
			if (health.data?.password === false) {
				window.location.href = "/api/oidc";
				return;
			}
			try {
				await login(user.email, password);
				// Trigger a Health change
				await queryClient.refetchQueries({ queryKey: ["health"] });
				// window.location.reload();
			} catch (err) {
				setErrorMsg(<T id={err.message} />);
			}
		} catch (err) {
			setErrorMsg(<T id={err.message} />);
		}
	};

	return (
		<Page className="page-center">
			<div className="container container-tight py-4">
				<div className="d-flex justify-content-between align-items-center mb-4 ps-4 pe-3">
					<img width={200} src="/images/logo-text-horizontal-grey.png" alt="NPMplus" />
					<div className="d-flex align-items-center gap-1">
						<LocalePicker />
						<ThemeSwitcher />
					</div>
				</div>
				<div className="card card-md">
					<Alert variant="danger" show={errorMsg} onClose={() => setErrorMsg(null)} dismissible>
						{errorMsg}
					</Alert>
					<Formik
						initialValues={{
							name: "",
							email: "",
							password: "",
						}}
						onSubmit={onSubmit}
					>
						{({ isSubmitting }) => (
							<Form>
								<div className="card-body text-center py-4 p-sm-5">
									<h1 className="mt-5">
										<T id="setup.title" />
									</h1>
									<p className="text-secondary">
										<T id="setup.preamble" />
									</p>
								</div>
								<hr />
								<div className="card-body">
									<div className="mb-3">
										<Field name="name" validate={(value) => validateString(value, 1, 255)}>
											{({ field, meta }) => (
												<div className="form-floating mb-3">
													<input
														id="name"
														autoComplete="name"
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
														autoComplete="username"
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
									<div className="mb-3">
										<Field
											name="password"
											validate={(value) => validateString(value, 8, 255, false)}
										>
											{({ field, meta }) => (
												<div className="input-group input-group-flat">
													<div className="form-floating">
														<input
															id="password"
															type={showPassword ? "text" : "password"}
															autoComplete="new-password"
															required
															className={`form-control ${meta.touched && meta.error ? "is-invalid" : ""}`}
															placeholder={intl.formatMessage({
																id: "user.new-password",
															})}
															{...field}
														/>

														<label htmlFor="password">
															<T id="user.new-password" />
														</label>
													</div>
													<span className="input-group-text">
														<button
															type="button"
															tabIndex={-1}
															aria-label="toggle visibility"
															className="p-0 border-0 bg-transparent text-secondary d-flex align-items-center cursor-pointer"
															onClick={() => setShowPassword((v) => !v)}
														>
															{showPassword ? (
																<IconEyeOff size={18} />
															) : (
																<IconEye size={18} />
															)}
														</button>
													</span>
												</div>
											)}
										</Field>
										<ErrorMessage
											name="password"
											component="div"
											className="invalid-feedback d-block"
										/>
									</div>
								</div>
								<div className="text-center my-3 mx-3">
									<Button
										type="submit"
										actionType="primary"
										isLoading={isSubmitting}
										disabled={isSubmitting}
										className="w-100"
									>
										<T id="save" />
									</Button>
								</div>
							</Form>
						)}
					</Formik>
				</div>
			</div>
		</Page>
	);
}
