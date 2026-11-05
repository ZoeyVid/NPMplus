import cn from "clsx";

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
		<button
			type={type || "button"}
			className={cns}
			onClick={() => !isLoading && onClick?.()}
			disabled={disabled}
			// biome-ignore lint/a11y/noAutofocus: only used for the initial focus inside modals
			autoFocus={autoFocus}
		>
			{children}
		</button>
	);
}

export { Button };
