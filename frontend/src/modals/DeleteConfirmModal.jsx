import { IconAlertTriangle } from "@tabler/icons-react";
import { Form, Formik } from "formik";
import { useState } from "react";
import { Alert } from "react-bootstrap";
import Modal from "react-bootstrap/Modal";
import { Button } from "src/components";
import { T } from "src/locale";
import EasyModal from "src/modules/easyModal";

const showDeleteConfirmModal = (props) => {
	EasyModal.show(DeleteConfirmModal, props);
};

const DeleteConfirmModal = EasyModal.create(
	({ title, tTitle, children, subject, details, onConfirm, visible, remove, close, formRef }) => {
		const [error, setError] = useState(null);

		const onSubmit = async () => {
			setError(null);
			try {
				await onConfirm();
				remove();
			} catch (err) {
				setError(<T id={err.message} />);
			}
		};

		return (
			<Modal show={visible} backdrop="static" onHide={close}>
				<Formik innerRef={formRef} initialValues={{}} onSubmit={onSubmit}>
					{() => (
						<Form>
							<Modal.Header closeButton>
								<Modal.Title>{tTitle ? <T id={tTitle} /> : title}</Modal.Title>
							</Modal.Header>
							<Modal.Body>
								<Alert variant="danger" show={error} onClose={() => setError(null)} dismissible>
									{error}
								</Alert>
								<div className="text-center mb-3">
									<IconAlertTriangle className="icon mb-2 text-danger icon-lg" />
								</div>
								<div className="text-center mb-3">
									{children}
									{subject ? <div className="mt-2 fw-bold text-break">{subject}</div> : null}
									{details ? (
										<div className="mt-1 text-secondary small text-break">{details}</div>
									) : null}
								</div>
							</Modal.Body>
							<Modal.Footer>
								<Button onClick={close} autoFocus>
									<T id="cancel" />
								</Button>
								<Button type="submit" actionType="primary" className="ms-auto btn-red">
									<T id={tTitle ?? "action.delete"} />
								</Button>
							</Modal.Footer>
						</Form>
					)}
				</Formik>
			</Modal>
		);
	},
);

export { showDeleteConfirmModal };
