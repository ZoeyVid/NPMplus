import Markdown from "markdown-to-jsx";
import Modal from "react-bootstrap/Modal";
import { getHelpFile, T } from "src/locale";
import EasyModal from "src/modules/easyModal";

const showHelpModal = (section) => {
	EasyModal.show(HelpModal, { section });
};

const HelpModal = EasyModal.create(({ section, visible, remove }) => {
	const markdownText = getHelpFile(section);

	return (
		<Modal show={visible} onHide={remove}>
			<Modal.Header closeButton>
				<Modal.Title>
					<T id="help" />
				</Modal.Title>
			</Modal.Header>
			<Modal.Body>
				<Markdown options={{ disableParsingRawHTML: true }}>{markdownText}</Markdown>
			</Modal.Body>
		</Modal>
	);
});

export { showHelpModal };
