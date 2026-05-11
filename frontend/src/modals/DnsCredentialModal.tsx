import CodeEditor from "@uiw/react-textarea-code-editor";
import EasyModal, { type InnerModalProps } from "ez-modal-react";
import { Form, Formik } from "formik";
import { type ReactNode, useState } from "react";
import { Alert } from "react-bootstrap";
import Modal from "react-bootstrap/Modal";
import { Button, Loading } from "src/components";
import { useDnsCredential, useDnsProviders, useSetDnsCredential } from "src/hooks";
import { T } from "src/locale";
import { showObjectSuccess } from "src/notifications";

const showDnsCredentialModal = (id: number | "new") => {
	EasyModal.show(DnsCredentialModal, { id });
};

interface Props extends InnerModalProps {
	id: number;
}

const DnsCredentialModal = EasyModal.create(({ id, visible, remove }: Props) => {
	const isNew = id === -1;
	const { data, isLoading, error } = useDnsCredential(isNew ? -1 : id);
	const { data: dnsProviders } = useDnsProviders();
	const { mutate: setDnsCredential } = useSetDnsCredential();
	const [errorMsg, setErrorMsg] = useState<ReactNode | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const onSubmit = async (values: any, { setSubmitting }: any) => {
		if (isSubmitting) return;
		setIsSubmitting(true);
		setErrorMsg(null);

		try {
			if (!values?.credentials) {
				setErrorMsg(<T id="dns-credentials-empty" />);
				return;
			}

			const payload = {
				...(isNew ? {} : { id }),
				providerId: values.provider_id,
				credentials: values.credentials,
				name: values.name,
			};

			setDnsCredential(payload as any, {
				onError: (err: any) => {
					setErrorMsg(<T id={err.message} />);
				},
				onSuccess: () => {
					showObjectSuccess("dns-credentials", "saved");
					remove();
				},
				onSettled: () => {
					setSubmitting(false);
				},
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	const providerOptions =
		dnsProviders?.map((p) => ({
			value: p.id,
			label: p.name,
		})) || [];

	return (
		<Modal show={visible} onHide={remove}>
			{!isLoading && error && (
				<Alert variant="danger" className="m-3">
					{error?.message || "Unknown error"}
				</Alert>
			)}
			{isLoading && <Loading noLogo />}
			{((isNew && !isLoading) || (!isNew && !isLoading && data)) && (
				<Formik
					initialValues={
						{
							name: data?.name || "",
							provider_id: data?.providerId || "",
							credentials: data?.credentials || "",
						} as any
					}
					onSubmit={onSubmit}
				>
					{({ values, setFieldValue }) => (
						<Form>
							<Modal.Header closeButton>
								<Modal.Title>
									<T
										id={isNew ? "object.add" : "action.edit"}
										tData={{ object: "dns-credentials" }}
									/>
								</Modal.Title>
							</Modal.Header>
							<Modal.Body className="p-0">
								<Alert variant="danger" show={!!errorMsg} onClose={() => setErrorMsg(null)} dismissible>
									{errorMsg}
								</Alert>
								<div className="card m-0 border-0">
									<div className="card-body">
										<div className="mb-3">
											<label className="form-label" htmlFor="dns-credential-name">
												<T id="settings.dns-credentials.name" />
											</label>
											<input
												id="dns-credential-name"
												className="form-control input-sm"
												type="text"
												value={values.name}
												onChange={(e) => setFieldValue("name", e.target.value)}
												required
											/>
										</div>

										<div className="mb-3">
											<label className="form-label" htmlFor="dns-credential-provider">
												<T id="settings.dns-credentials.provider" />
											</label>
											<select
												id="dns-credential-provider"
												className="form-select"
												value={values.provider_id}
												onChange={(e) => {
													setFieldValue("provider_id", e.target.value);
													const provider = dnsProviders?.find((p) => p.id === e.target.value);
													if (provider) {
														setFieldValue("credentials", provider.credentials);
													}
												}}
												required
											>
												<option value="">
													<T id="settings.dns-credentials.select-provider" />
												</option>
												{providerOptions.map((opt) => (
													<option key={opt.value} value={opt.value}>
														{opt.label}
													</option>
												))}
											</select>
										</div>

										<div className="mb-3">
											<label className="form-label" htmlFor="dns-credential-credentials">
												<T id="settings.dns-credentials.credentials" />
											</label>
											<CodeEditor
												language="bash"
												padding={15}
												data-color-mode="dark"
												minHeight={130}
												indentWidth={2}
												style={{
													fontFamily:
														"ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace",
													borderRadius: "0.3rem",
												}}
												value={values.credentials}
												onChange={(e) => setFieldValue("credentials", e.target.value)}
											/>
											<small className="text-muted">
												<T id="settings.dns-credentials.credentials-note" />
											</small>
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
			)}
		</Modal>
	);
});

export { showDnsCredentialModal };
