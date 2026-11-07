import NiceModal, { useModal } from "@ebay/nice-modal-react";
import { useEffect, useRef } from "react";
import Modal from "react-bootstrap/Modal";
import { Button } from "src/components/Button";
import { T } from "src/locale";
import { dropdownToggle } from "src/modules/Focus";

const DiscardChangesModal = NiceModal.create(() => {
	const { visible, resolve, remove } = useModal();
	const close = (discard) => {
		resolve(discard);
		remove();
	};

	return (
		<Modal
			show={visible}
			backdrop="static"
			backdropClassName="d-none"
			className="bg-black bg-opacity-25"
			centered
			onHide={() => close(false)}
		>
			<Modal.Header closeButton>
				<Modal.Title>
					<T id="unsaved-changes" />
				</Modal.Title>
			</Modal.Header>
			<Modal.Body>
				<T id="unsaved-changes.content" />
			</Modal.Body>
			<Modal.Footer>
				<Button onClick={() => close(false)} autoFocus>
					<T id="action.keep-editing" />
				</Button>
				<Button actionType="primary" className="ms-auto btn-red" onClick={() => close(true)}>
					<T id="action.discard" />
				</Button>
			</Modal.Footer>
		</Modal>
	);
});

const show = (modal, args) => {
	dropdownToggle(document.activeElement?.closest(".dropdown"))?.focus();
	return NiceModal.show(modal, args);
};

const create = (Comp) =>
	NiceModal.create((props) => {
		const { visible, remove } = useModal();
		const formRef = useRef(null);

		useEffect(() => {
			const warnBeforeUnload = (e) => {
				if (formRef.current?.dirty) e.preventDefault();
			};
			addEventListener("beforeunload", warnBeforeUnload);
			return () => removeEventListener("beforeunload", warnBeforeUnload);
		}, []);

		const close = async () => {
			if (formRef.current?.isSubmitting) return;
			if (!formRef.current?.dirty || (await NiceModal.show(DiscardChangesModal))) remove();
		};

		return <Comp {...props} visible={visible} remove={remove} close={close} formRef={formRef} />;
	});

export default { ...NiceModal, create, show };
