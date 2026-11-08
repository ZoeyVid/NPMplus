import { IconEye, IconEyeOff } from "@tabler/icons-react";
import { ErrorMessage, Field, Form, Formik } from "formik";
import { useEffect, useState } from "react";
import Alert from "react-bootstrap/Alert";
import { Button, LocalePicker, Page, ThemeSwitcher } from "src/components";
import { useAuthState } from "src/context";
import { useHealth } from "src/hooks";
import { intl, T } from "src/locale";
import { getCookie } from "src/modules/Cookies";
import { validateEmail, validateString } from "src/modules/Validations";

const redirectToOIDC = () => {
	window.location.href = "/api/oidc";
};

function TotpForm({ formErr, setFormErr }) {
	const [showCode, setShowCode] = useState(false);
	const { submitTotp, cancelTotp } = useAuthState();

	const onSubmit = async (values, { resetForm }) => {
		setFormErr("");
		try {
			await submitTotp(values);
		} catch (err) {
			setFormErr(err.message);
			resetForm();
			if (err.message === "error.invalid-challenge") cancelTotp();
		}
	};

	return (
		<>
			<h2 className="h2 text-center mb-4">
				<T id="login.totp-title" />
			</h2>
			<p className="text-secondary text-center mb-4">
				<T id="login.totp-description" />
			</p>
			{formErr !== "" && <Alert variant="danger">{intl.formatMessage({ id: formErr })}</Alert>}
			<Formik initialValues={{ code: "" }} onSubmit={onSubmit}>
				{() => (
					<Form>
						<div className="mb-3">
							<Field name="code" validate={(value) => validateString(value, 6, 8)}>
								{({ field, meta }) => (
									<label className="form-label">
										<T id="login.totp-code" />
										<div className="input-group input-group-flat">
											<input
												{...field}
												autoFocus
												type={showCode || !field.value ? "text" : "password"}
												autoComplete="one-time-code"
												required
												maxLength={8}
												className={`form-control ${meta.touched && meta.error ? "is-invalid" : ""}`}
												placeholder={intl.formatMessage({
													id: "login.totp-code-placeholder",
												})}
											/>

											<span className="input-group-text">
												<button
													type="button"
													title={intl.formatMessage({
														id: showCode ? "mfa.hide-code" : "mfa.show-code",
													})}
													onMouseDown={(e) => e.preventDefault()}
													className="p-0 border-0 bg-transparent text-secondary d-flex align-items-center cursor-pointer"
													onClick={() => setShowCode((v) => !v)}
												>
													{showCode ? <IconEyeOff size={18} /> : <IconEye size={18} />}
												</button>
											</span>
										</div>
										<ErrorMessage
											name="code"
											component="div"
											className="invalid-feedback d-block"
										/>
									</label>
								)}
							</Field>
						</div>
						<div className="form-footer d-flex gap-2">
							<Button
								type="button"
								fullWidth
								onClick={() => {
									setFormErr("");
									cancelTotp();
								}}
							>
								<T id="cancel" />
							</Button>
							<Button type="submit" fullWidth color="azure">
								<T id="login.totp-verify" />
							</Button>
						</div>
					</Form>
				)}
			</Formik>
		</>
	);
}

function PasswordForm({ formErr, setFormErr }) {
	const [showPassword, setShowPassword] = useState(false);
	const { login } = useAuthState();
	const health = useHealth();

	const onSubmit = async (values) => {
		setFormErr("");
		try {
			await login(values.email, values.password);
		} catch (err) {
			setFormErr(err.message);
		}
	};

	useEffect(() => {
		if (health.data?.password === false && getCookie("__Host-npmplus_oidc_no_redirect") !== "true") {
			redirectToOIDC();
		}
		window.cookieStore.delete("__Host-npmplus_oidc_no_redirect");
	}, [health.data?.password]);

	return (
		<>
			<h2 className="h2 text-center mb-4">
				<T id="login.title" />
			</h2>
			{formErr !== "" && <Alert variant="danger">{intl.formatMessage({ id: formErr })}</Alert>}
			{health.data?.password && (
				<Formik
					initialValues={{
						email: "",
						password: "",
					}}
					onSubmit={onSubmit}
				>
					{() => (
						<Form>
							<div className="mb-3">
								<Field name="email" validate={validateEmail}>
									{({ field, meta }) => (
										<label className="form-label">
											<T id="email-address" />
											<input
												{...field}
												autoFocus
												type="email"
												autoComplete="username"
												required
												className={`form-control ${meta.touched && meta.error ? "is-invalid" : ""}`}
												placeholder={intl.formatMessage({
													id: "email-address",
												})}
											/>

											<ErrorMessage name="email" component="div" className="invalid-feedback" />
										</label>
									)}
								</Field>
							</div>
							<div className="mb-2">
								<Field name="password">
									{({ field }) => (
										<>
											<label className="form-label">
												<T id="password" />
												<div className="input-group input-group-flat">
													<input
														{...field}
														type={showPassword ? "text" : "password"}
														autoComplete="current-password"
														required
														maxLength={255}
														className="form-control"
														placeholder={intl.formatMessage({ id: "password" })}
													/>

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
															{showPassword ? (
																<IconEyeOff size={18} />
															) : (
																<IconEye size={18} />
															)}
														</button>
													</span>
												</div>
											</label>
										</>
									)}
								</Field>
							</div>
							<div className="form-footer">
								<Button type="submit" fullWidth color="azure">
									<T id="sign-in" />
								</Button>
							</div>
						</Form>
					)}
				</Formik>
			)}
			{health.data?.password && health.data?.oidc && (
				<div className="hr-text my-3">
					<T id="or" />
				</div>
			)}
			{health.data?.oidc && (
				<div className="form-footer my-0">
					<Button type="button" fullWidth color="azure" onClick={redirectToOIDC}>
						<T id="sign-in-with-oidc" />
					</Button>
				</div>
			)}
		</>
	);
}

export default function Login() {
	const { totpChallenge } = useAuthState();
	const [formErr, setFormErr] = useState("");

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
					<div className="card-body">
						{totpChallenge ? (
							<TotpForm formErr={formErr} setFormErr={setFormErr} />
						) : (
							<PasswordForm formErr={formErr} setFormErr={setFormErr} />
						)}
					</div>
				</div>
			</div>
		</Page>
	);
}
