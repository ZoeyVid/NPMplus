import cn from "clsx";
import { Flag } from "src/components";
import { useTheme } from "src/hooks";
import { getFlagCodeForLocale, localeList, localeOptions } from "src/locale";
import styles from "./LocalePicker.module.css";

function LocalePicker({ menuAlign = "start" }) {
	const { getTheme } = useTheme();

	const changeTo = (lang) => {
		window.localStorage.setItem("locale", lang);
		location.reload();
	};

	const classes = ["btn", "dropdown-toggle", "btn-sm", styles.btn];
	const cns = cn(...classes, getTheme() === "dark" ? "btn-ghost-dark" : "btn-ghost-light");

	return (
		<div className="dropdown">
			<button type="button" className={cns} data-bs-toggle="dropdown">
				<Flag countryCode={getFlagCodeForLocale()} />
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
