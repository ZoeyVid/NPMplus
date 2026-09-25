import cn from "clsx";

export function Page({ children, className }) {
	return <div className={cn("page", className)}>{children}</div>;
}
