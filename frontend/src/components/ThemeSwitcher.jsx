import { IconMoon, IconSun } from "@tabler/icons-react";
import cn from "clsx";
import { useThemeState } from "src/context";
import { intl } from "src/locale";

function ThemeSwitcher({ className }) {
	const { theme, setTheme } = useThemeState();
	const dark = theme === "dark";

	return (
		<div className={cn("d-print-none", "d-inline-block", className)}>
			<button
				type="button"
				className="btn btn-sm btn-ghost"
				title={intl.formatMessage({ id: dark ? "user.switch-light" : "user.switch-dark" })}
				onClick={() => setTheme(dark ? "light" : "dark")}
			>
				{dark ? <IconSun width={24} /> : <IconMoon width={24} />}
			</button>
		</div>
	);
}

export { ThemeSwitcher };
