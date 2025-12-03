import { motion } from "framer-motion";
import type { ReactNode } from "react";
import Modal from "react-bootstrap/Modal";

interface Props {
	children: ReactNode;
	className?: string;
}

export const AnimatedModalBody = ({ children, className }: Props) => {
	return (
		<Modal.Body
			className={className}
			as={motion.div}
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.3 }}
		>
			{children}
		</Modal.Body>
	);
};
