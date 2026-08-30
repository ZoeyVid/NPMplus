import Markdown from "markdown-to-jsx";
import Modal from "react-bootstrap/Modal";
import { getHelpFile, getLocale, T } from "src/locale";
import EasyModal, { type InnerModalProps } from "src/modules/easyModal";

interface Props extends InnerModalProps {
	section: string;
}

const showHelpModal = (section: string) => {
	EasyModal.show(HelpModal, { section });
};

const HelpModal = EasyModal.create(({ section, visible, remove }: Props) => {
	const markdownText = getHelpFile(getLocale(), section);

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
