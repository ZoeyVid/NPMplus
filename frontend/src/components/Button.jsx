import cn from "clsx";
import { FormikContext } from "formik";
import { useContext } from "react";

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
	autoFocus,
}) {
	const submitting = useContext(FormikContext)?.isSubmitting;
	const cns = cn(
		"btn",
		className,
		actionType && `btn-${actionType}`,
		variant && `btn-${variant}`,
		size && `btn-${size}`,
		color && `btn-${color}`,
		fullWidth && "w-100",
		(isLoading || (submitting && type === "submit")) && "btn-loading",
	);

	return (
		<button
			type={type || "button"}
			className={cns}
			onClick={onClick}
			disabled={disabled || isLoading || submitting}
			autoFocus={autoFocus}
		>
			{children}
		</button>
	);
}

export { Button };
