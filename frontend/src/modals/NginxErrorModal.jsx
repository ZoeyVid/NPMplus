import Modal from "react-bootstrap/Modal";
import { Button, CommandOutput } from "src/components";
import { T } from "src/locale";
import EasyModal from "src/modules/easyModal";

const showNginxErrorModal = (nginxErr) => {
	EasyModal.show(NginxErrorModal, { nginxErr });
};

const NginxErrorModal = EasyModal.create(({ nginxErr, visible, remove }) => (
	<Modal show={visible} backdrop="static" onHide={remove}>
		<Modal.Header closeButton>
			<Modal.Title>
				<T id="offline" />
			</Modal.Title>
		</Modal.Header>
		<Modal.Body>
			<CommandOutput output={nginxErr} />
		</Modal.Body>
		<Modal.Footer>
			<Button onClick={remove}>
				<T id="action.close" />
			</Button>
		</Modal.Footer>
	</Modal>
));

export { showNginxErrorModal };
