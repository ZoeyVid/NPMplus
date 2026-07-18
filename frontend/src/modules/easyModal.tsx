import NiceModal, { useModal } from "@ebay/nice-modal-react";
import type { FC } from "react";

export type InnerModalProps = { visible: boolean; remove: () => void };

const create = <P extends InnerModalProps>(Comp: FC<P>) =>
	NiceModal.create((props: Omit<P, keyof InnerModalProps>) => {
		const { visible, remove } = useModal();
		return <Comp {...(props as unknown as P)} visible={visible} remove={remove} />;
	}) as unknown as FC<Omit<P, keyof InnerModalProps>>;

export default { ...NiceModal, create };
