import type { CSSProperties } from "react";
import { intl, T } from "src/locale";
import styles from "./Dashboard.module.css";
import { WORLD_LAND_PATH } from "./WorldMapLand";

interface AttackMapItem {
	latitude: number;
	longitude: number;
	country: string;
	count: number;
}

const AttackMap = ({ items }: { items: AttackMapItem[] }) => {
	const plotted = items
		.filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude))
		.slice(0, 12);
	const duration = `${Math.max(5, plotted.length * 1.1)}s`;
	const position = (item: (typeof plotted)[number]) => ({
		x: Math.min(708, Math.max(12, 360 + item.longitude * 2)),
		y: Math.min(348, Math.max(12, 180 - item.latitude * 2)),
	});
	const countryCount = new Set(plotted.map((item) => item.country).filter(Boolean)).size;
	const largestLocationCount = Math.max(1, ...plotted.map((item) => item.count));
	const summary = intl.formatMessage(
		{ id: "crowdsec.attack-map.summary" },
		{ count: plotted.reduce((sum, item) => sum + item.count, 0), countries: countryCount },
	);
	return (
		<figure className="mb-0">
			<div className={styles.mapFrame}>
				<div className={styles.mapBadge}>
					<span className={styles.mapBadgeDot} />
					<T id="crowdsec.attack-map.observed" />
				</div>
				<svg className={styles.worldMap} viewBox="0 0 720 360" role="img" aria-label={summary}>
					<title>{summary}</title>
					<desc>{intl.formatMessage({ id: "crowdsec.attack-map.motion-note" })}</desc>
					<defs>
						{/* the trail fades tail-to-head in each meteor's local coordinates */}
						<linearGradient
							id="meteor-fade"
							gradientUnits="userSpaceOnUse"
							x1="-22"
							y1="-14"
							x2="-3"
							y2="-2"
						>
							<stop offset="0" stopColor="#ff9862" stopOpacity="0" />
							<stop offset="0.55" stopColor="#ff9862" stopOpacity="0.45" />
							<stop offset="1" stopColor="#ff9862" stopOpacity="1" />
						</linearGradient>
					</defs>
					{[-60, -30, 0, 30, 60].map((latitude) => (
						<line
							key={latitude}
							x1="0"
							y1={180 - latitude * 2}
							x2="720"
							y2={180 - latitude * 2}
							className={styles.worldGrid}
						/>
					))}
					{[-120, -60, 0, 60, 120].map((longitude) => (
						<line
							key={longitude}
							x1={360 + longitude * 2}
							y1="0"
							x2={360 + longitude * 2}
							y2="360"
							className={styles.worldGrid}
						/>
					))}
					<line x1="0" y1="0" x2="720" y2="0" className={styles.mapScan} />
					<path d={WORLD_LAND_PATH} className={styles.worldLandShadow} />
					<path d={WORLD_LAND_PATH} className={styles.worldLand} />
					{plotted.map((item, index) => {
						const { x, y } = position(item);
						const label = `${item.country || intl.formatMessage({ id: "unknown" })}: ${intl.formatNumber(item.count)}`;
						const animationStyle = {
							"--meteor-delay": `${index * 1.1}s`,
							"--meteor-duration": duration,
						} as CSSProperties;
						return (
							<g
								key={`${item.latitude}-${item.longitude}-${item.country}`}
								transform={`translate(${x} ${y})`}
							>
								<title>{label}</title>
								<g className={styles.meteor} style={animationStyle}>
									<path d="M-22 -14 Q-14 -9.5 -3 -2" className={styles.meteorTrail} />
									<circle cx="0" cy="0" r="3.5" className={styles.meteorHead} />
								</g>
								<circle r={Math.min(11, 3.5 + Math.sqrt(item.count))} className={styles.locationDot} />
								<circle r="5" className={styles.locationPulse} style={animationStyle} />
							</g>
						);
					})}
				</svg>
			</div>
			<figcaption className="mt-2">
				<div className={styles.locationLegend}>
					{plotted.slice(0, 3).map((item) => (
						<div
							className={`${styles.locationLegendItem} small`}
							key={`${item.country}-${item.latitude}-${item.longitude}`}
						>
							<div className="d-flex justify-content-between gap-2 mb-1">
								<span className="text-truncate">{item.country || <T id="unknown" />}</span>
								<span className="badge bg-red-lt">{intl.formatNumber(item.count)}</span>
							</div>
							<div className={styles.locationBarTrack}>
								<span
									className={styles.locationBar}
									style={{ width: `${Math.max(6, (item.count / largestLocationCount) * 100)}%` }}
								/>
							</div>
						</div>
					))}
				</div>
				<ol className="visually-hidden">
					{plotted.map((item) => (
						<li key={`${item.country}-${item.latitude}-${item.longitude}`}>
							{item.country || <T id="unknown" />}: {intl.formatNumber(item.count)}
						</li>
					))}
				</ol>
				<div className="text-secondary small mt-2">
					<T id="crowdsec.attack-map.motion-note" />
				</div>
			</figcaption>
		</figure>
	);
};

export default AttackMap;
