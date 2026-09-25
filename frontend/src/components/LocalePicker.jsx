import cn from "clsx";
import { Flag } from "src/components";
import { changeLocale, getFlagCodeForLocale, localeOptions } from "src/locale";
import localeList from "translations/lang-list.json" with { type: "json" };

function LocalePicker({ menuAlign = "start" }) {
	return (
		<div className="dropdown">
			<button type="button" className="btn dropdown-toggle btn-sm btn-ghost" data-bs-toggle="dropdown">
				<Flag countryCode={getFlagCodeForLocale()} />
			</button>
			<div
				className={cn("dropdown-menu scroll-y", {
					"dropdown-menu-end": menuAlign === "end",
				})}
				style={{ maxHeight: "50vh" }}
			>
				{localeOptions.map((item) => (
					<button type="button" className="dropdown-item" key={item} onClick={() => changeLocale(item)}>
						<Flag countryCode={getFlagCodeForLocale(item)} /> {localeList[item].name}
					</button>
				))}
			</div>
		</div>
	);
}

export { LocalePicker };
