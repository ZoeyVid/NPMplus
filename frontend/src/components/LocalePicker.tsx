import cn from "clsx";
import { Flag } from "src/components";
import { useLocaleState } from "src/context";
import { useTheme } from "src/hooks";
import { changeLocale, getFlagCodeForLocale, localeList, localeOptions } from "src/locale";
import styles from "./LocalePicker.module.css";

interface Props {
	menuAlign?: "start" | "end";
}

function LocalePicker({ menuAlign = "start" }: Props) {
	const { locale } = useLocaleState();
	const { getTheme } = useTheme();

	const changeTo = (lang: string) => {
		changeLocale(lang);
		location.reload();
	};

	const classes = ["btn", "dropdown-toggle", "btn-sm", styles.btn];
	const cns = cn(...classes, getTheme() === "dark" ? "btn-ghost-dark" : "btn-ghost-light");

	return (
		<div className="dropdown">
			<button type="button" className={cns} data-bs-toggle="dropdown">
				<Flag countryCode={getFlagCodeForLocale(locale)} />
			</button>
			<div
				className={cn("dropdown-menu scroll-y", {
					"dropdown-menu-end": menuAlign === "end",
				})}
				style={{ maxHeight: "50vh" }}
			>
				{localeOptions.map((item) => (
					<button
						type="button"
						className="dropdown-item"
						key={item}
						onClick={() => {
							changeTo(item);
						}}
					>
						<Flag countryCode={getFlagCodeForLocale(item)} /> {localeList[item].name}
					</button>
				))}
			</div>
		</div>
	);
}

export { LocalePicker };
