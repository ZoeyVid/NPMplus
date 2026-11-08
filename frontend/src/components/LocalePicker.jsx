import cn from "clsx";
import { Flag } from "src/components";
import { changeLocale, getFlagCodeForLocale, intl, localeOptions } from "src/locale";
import localeList from "translations/lang-list.json" with { type: "json" };

function LocalePicker({ menuAlign }) {
	return (
		<div className="dropdown">
			<button
				type="button"
				className="btn dropdown-toggle btn-sm btn-ghost"
				data-bs-toggle="dropdown"
				aria-label={intl.formatMessage({ id: "language" })}
			>
				<Flag countryCode={getFlagCodeForLocale()} />
			</button>
			<div
				className={cn("dropdown-menu dropdown-menu-scrollable scroll-y", {
					"dropdown-menu-end": menuAlign === "end",
				})}
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
