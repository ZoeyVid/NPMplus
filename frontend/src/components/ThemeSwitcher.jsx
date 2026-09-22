import { IconMoon, IconSun } from "@tabler/icons-react";
import cn from "clsx";
import { useThemeState } from "src/context";
import { intl } from "src/locale";
import styles from "./ThemeSwitcher.module.css";

function ThemeSwitcher({ className }) {
	const { setTheme } = useThemeState();

	return (
		<div className={cn("d-print-none", "d-inline-block", className)}>
			<button
				type="button"
				className={cn("btn", "btn-sm", "btn-ghost-dark", "hide-theme-dark", styles.lightBtn)}
				title={intl.formatMessage({ id: "user.switch-dark" })}
				onClick={() => setTheme("dark")}
			>
				<IconMoon width={24} />
			</button>
			<button
				type="button"
				className={cn("btn", "btn-sm", "btn-ghost-light", "hide-theme-light", styles.darkBtn)}
				title={intl.formatMessage({ id: "user.switch-light" })}
				onClick={() => setTheme("light")}
			>
				<IconSun width={24} />
			</button>
		</div>
	);
}

export { ThemeSwitcher };
