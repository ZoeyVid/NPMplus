import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Alert } from "react-bootstrap";
import Modal from "react-bootstrap/Modal";
import { renewCertificate } from "src/api/backend";
import { Button, Loading } from "src/components";
import { useCertificate } from "src/hooks";
import { T } from "src/locale";
import EasyModal from "src/modules/easyModal";
import { showObjectSuccess } from "src/notifications";

const showRenewCertificateModal = (id) => {
	EasyModal.show(RenewCertificateModal, { id });
};

const RenewCertificateModal = EasyModal.create(({ id, visible, remove }) => {
	const queryClient = useQueryClient();
	const { data, isLoading, error } = useCertificate(id);
	const [errorMsg, setErrorMsg] = useState(null);
	const [isFresh, setIsFresh] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);

	useEffect(() => {
		if (!data || !isFresh || isSubmitting) return;
		setIsFresh(false);
		setIsSubmitting(true);

		void (async () => {
			try {
				await renewCertificate(id);
				showObjectSuccess("certificate", "renewed");
				await queryClient.invalidateQueries({ queryKey: ["certificates"] });
				remove();
			} catch (err) {
				if (err.payload?.error?.output) {
					setErrorMsg(
						<div className="w-100">
							<pre>
								<code>{err.payload.error.output}</code>
							</pre>
						</div>,
					);
				} else {
					setErrorMsg(<T id={err.message} />);
				}
			} finally {
				setIsSubmitting(false);
			}
		})();
	}, [id, data, isFresh, isSubmitting, remove, queryClient]);

	return (
		<Modal show={visible} onHide={isSubmitting ? undefined : remove}>
			<Modal.Header closeButton={!isSubmitting}>
				<Modal.Title>
					<T id="certificate.renew" />
				</Modal.Title>
			</Modal.Header>
			<Modal.Body>
				<Alert variant="danger" show={Boolean(errorMsg)}>
					{errorMsg}
				</Alert>
				{isLoading && <Loading noLogo />}
				{!isLoading && error && (
					<Alert variant="danger" className="m-3">
						{error?.message || "Unknown error"}
					</Alert>
				)}
				{data && isSubmitting && !errorMsg ? <p className="text-center mt-3">Please wait ...</p> : null}
			</Modal.Body>
			<Modal.Footer>
				<Button data-bs-dismiss="modal" onClick={remove} disabled={isSubmitting}>
					<T id="action.close" />
				</Button>
			</Modal.Footer>
		</Modal>
	);
});

export { showRenewCertificateModal };
