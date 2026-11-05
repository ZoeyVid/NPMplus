import NiceModal, { useModal } from "@ebay/nice-modal-react";
import { dropdownToggle } from "src/modules/Focus";

const show = (modal, args) => {
	dropdownToggle(document.activeElement?.closest(".dropdown"))?.focus();
	return NiceModal.show(modal, args);
};

const create = (Comp) =>
	NiceModal.create((props) => {
		const { visible, remove } = useModal();
		return <Comp {...props} visible={visible} remove={remove} />;
	});

export default { ...NiceModal, create, show };
