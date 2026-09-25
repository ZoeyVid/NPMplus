import { Alert } from "react-bootstrap";
import Modal from "react-bootstrap/Modal";
import { Button, EventFormatter, GravatarFormatter, Loading } from "src/components";
import { useAuditLog } from "src/hooks";
import { T } from "src/locale";
import EasyModal from "src/modules/easyModal";

const showEventDetailsModal = (id) => {
	EasyModal.show(EventDetailsModal, { id });
};

const EventDetailsModal = EasyModal.create(({ id, visible, remove }) => {
	const { data, isLoading, error } = useAuditLog(id);

	return (
		<Modal show={visible} onHide={remove}>
			{!isLoading && error && (
				<Alert variant="danger" className="m-3">
					{error?.message || "Unknown error"}
				</Alert>
			)}
			{isLoading && <Loading noLogo />}
			{!isLoading && data && (
				<>
					<Modal.Header closeButton>
						<Modal.Title>
							<T id="action.view-details" />
						</Modal.Title>
					</Modal.Header>
					<Modal.Body>
						<div className="row">
							<div className="col-md-2">
								<GravatarFormatter url={data.user?.avatar || ""} />
							</div>
							<div className="col-md-10">
								<EventFormatter row={data} />
							</div>
							<hr className="mt-4 mb-3" />
							<textarea
								className="form-control font-monospace"
								spellCheck={false}
								rows={9}
								readOnly
								value={JSON.stringify(data.meta, null, 2)}
							/>
						</div>
					</Modal.Body>
					<Modal.Footer>
						<Button onClick={remove}>
							<T id="action.close" />
						</Button>
					</Modal.Footer>
				</>
			)}
		</Modal>
	);
});

export { showEventDetailsModal };
