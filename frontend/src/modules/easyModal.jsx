import NiceModal, { useModal } from "@ebay/nice-modal-react";

const create = (Comp) =>
	NiceModal.create((props) => {
		const { visible, remove } = useModal();
		return <Comp {...props} visible={visible} remove={remove} />;
	});

export default { ...NiceModal, create };
