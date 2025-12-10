import cn from "classnames";
import { type HTMLMotionProps, motion } from "framer-motion";
import type { ReactNode } from "react";

interface Props extends Omit<HTMLMotionProps<"button">, "ref"> {
	children: ReactNode;
	className?: string;
	type?: "button" | "submit";
	actionType?: "primary" | "secondary" | "success" | "warning" | "danger" | "info" | "light" | "dark";
	variant?: "ghost" | "outline" | "pill" | "square" | "action";
	size?: "sm" | "md" | "lg" | "xl";
	fullWidth?: boolean;
	isLoading?: boolean;
	disabled?: boolean;
	color?:
		| "blue"
		| "azure"
		| "indigo"
		| "purple"
		| "pink"
		| "red"
		| "orange"
		| "yellow"
		| "lime"
		| "green"
		| "teal"
		| "cyan";
	onClick?: () => void;
}

function Button({
	children,
	className,
	onClick,
	type,
	actionType,
	variant,
	size,
	color,
	fullWidth,
	isLoading,
	disabled,
	...rest
}: Props) {
	const myOnClick = (_e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
		if (!isLoading && onClick) {
			onClick();
		}
	};

	const cns = cn(
		"btn",
		className,
		actionType && `btn-${actionType}`,
		variant && `btn-${variant}`,
		size && `btn-${size}`,
		color && `btn-${color}`,
		fullWidth && "w-100",
		isLoading && "btn-loading",
	);

	return (
		<motion.button
			type={type || "button"}
			className={cns}
			onClick={myOnClick}
			disabled={disabled || isLoading}
			whileHover={{ scale: 1.05 }}
			whileTap={{ scale: 0.95 }}
			transition={{ type: "spring", stiffness: 400, damping: 17 }}
			{...rest}
		>
			{children}
		</motion.button>
	);
}

export { Button };
