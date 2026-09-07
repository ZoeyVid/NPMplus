import type { CrowdsecInsightsItem } from "src/api/backend";
import { intl, T } from "src/locale";
import styles from "./Dashboard.module.css";
import { attackMixSegments } from "./utils";

const DONUT_COLORS = [
	"var(--tblr-azure)",
	"var(--tblr-purple)",
	"var(--tblr-pink)",
	"var(--tblr-orange)",
	"var(--tblr-blue)",
];
const DONUT_RADIUS = 48;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

const AttackMix = ({
	items,
	total,
	sampled,
	windowHours,
	onSelect,
}: {
	items: CrowdsecInsightsItem[];
	total: number;
	sampled: boolean;
	windowHours: number;
	onSelect: (value: string) => void;
}) => {
	const segments = attackMixSegments(items, total);
	const summary = intl.formatMessage({ id: "crowdsec.attack-mix.summary" }, { total, hours: windowHours });
	// the center total is formatted with locale grouping, so long attack counts
	// can outgrow the donut at the default size - step the font down instead of
	// letting the number collide with the ring or the label below it
	const totalLabel = `${intl.formatNumber(total)}${sampled ? "+" : ""}`;
	const totalFontSize = totalLabel.length <= 6 ? 24 : totalLabel.length <= 9 ? 19 : totalLabel.length <= 12 ? 16 : 13;
	let offset = 0;
	return (
		<figure className="mb-0">
			{segments.length === 0 ? (
				<div className="text-secondary text-center small py-5">
					<T id="crowdsec.activity.empty" />
				</div>
			) : (
				<div className="d-flex flex-wrap align-items-center gap-4">
					<svg className={styles.donut} viewBox="0 0 120 120" role="img" aria-label={summary}>
						<title>{summary}</title>
						<g transform="rotate(-90 60 60)">
							{segments.map((segment) => {
								const length = segment.share * DONUT_CIRCUMFERENCE;
								// shave a hair off each slice so neighbours stay separated
								const visible = Math.max(0, length - 1.5);
								const element = (
									<circle
										key={segment.name || "other"}
										cx="60"
										cy="60"
										r={DONUT_RADIUS}
										fill="none"
										strokeWidth="16"
										stroke={
											segment.color >= 0
												? DONUT_COLORS[segment.color % DONUT_COLORS.length]
												: "var(--tblr-secondary)"
										}
										strokeDasharray={`${visible} ${DONUT_CIRCUMFERENCE - visible}`}
										strokeDashoffset={-offset}
									>
										<title>{`${segment.name || intl.formatMessage({ id: "crowdsec.attack-mix.other" })}: ${intl.formatNumber(segment.count)}`}</title>
									</circle>
								);
								offset += length;
								return element;
							})}
						</g>
						<text
							x="60"
							y="54"
							textAnchor="middle"
							className={styles.donutTotal}
							style={{ fontSize: totalFontSize }}
						>
							{totalLabel}
						</text>
						<text x="60" y="76" textAnchor="middle" className={styles.donutLabel}>
							{intl.formatMessage({ id: "crowdsec.attack-mix" })}
						</text>
					</svg>
					{/* shrinkable: long scenario names must truncate inside the list
					    rather than pushing the legend wider than its card column */}
					<ul className={`list-unstyled mb-0 ${styles.donutList}`}>
						{segments.map((segment) => {
							const color =
								segment.color >= 0 ? DONUT_COLORS[segment.color % DONUT_COLORS.length] : "var(--tblr-secondary)";
							const label = segment.name || intl.formatMessage({ id: "crowdsec.attack-mix.other" });
							return (
								<li key={segment.name || "other"} className={styles.donutRow}>
									<span className={styles.donutDot} style={{ background: color }} aria-hidden="true" />
									{segment.name ? (
										<button
											type="button"
											className={styles.donutName}
											title={intl.formatMessage(
												{ id: "crowdsec.attack-mix.filter" },
												{ scenario: segment.name },
											)}
											onClick={() => onSelect(segment.name)}
										>
											{segment.name}
										</button>
									) : (
										<span className="text-secondary text-truncate">{label}</span>
									)}
									<span className="badge bg-secondary-lt flex-shrink-0">
										{intl.formatNumber(segment.count)}
									</span>
									<span className="text-secondary small flex-shrink-0">
										{intl.formatNumber(segment.share, {
											style: "percent",
											maximumFractionDigits: 1,
										})}
									</span>
								</li>
							);
						})}
					</ul>
				</div>
			)}
			<figcaption className="visually-hidden">{summary}</figcaption>
		</figure>
	);
};

export default AttackMix;