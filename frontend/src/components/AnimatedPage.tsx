import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface Props {
	children: ReactNode;
}

const animations = {
	initial: { opacity: 0, y: 20 },
	animate: { opacity: 1, y: 0 },
	exit: { opacity: 0, y: -20 },
};

export const AnimatedPage = ({ children }: Props) => {
	return (
		<motion.div
			variants={animations}
			initial="initial"
			animate="animate"
			exit="exit"
			transition={{ duration: 0.3 }}
		>
			{children}
		</motion.div>
	);
};
