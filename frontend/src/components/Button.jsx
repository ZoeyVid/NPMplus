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
	isSubmitting,
	disabled,
	autoFocus,
}) {
	const formSubmitting = useContext(FormikContext)?.isSubmitting;
	const cns = cn(
		"btn",
		className,
		actionType && `btn-${actionType}`,
		variant && `btn-${variant}`,
		size && `btn-${size}`,
		color && `btn-${color}`,
		fullWidth && "w-100",
		(isSubmitting || (formSubmitting && type === "submit")) && "btn-loading",
	);

	return (
		<button
			type={type || "button"}
			className={cns}
			onClick={(e) => (isSubmitting || formSubmitting ? e.preventDefault() : onClick?.(e))}
			disabled={disabled}
			autoFocus={autoFocus}
		>
			{children}
		</button>
	);
}

export { Button };
