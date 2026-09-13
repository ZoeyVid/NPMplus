import cn from "clsx";
import styles from "./Page.module.css";

export function Page({ children, className }) {
	return <div className={cn(className, styles.page)}>{children}</div>;
}
