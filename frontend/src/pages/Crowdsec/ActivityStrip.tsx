import type { CrowdsecInsights } from "src/api/backend";
import { formatDateTime, intl, T } from "src/locale";
import styles from "./Dashboard.module.css";

// thin per-interval bar strip: restores the "when" dimension next to the
// scenario mix. the last bucket (highlighted) answers "is it happening now"
const ActivityStrip = ({ activity, windowHours }: { activity: CrowdsecInsights["activity"]; windowHours: number }) => {
	if (activity.length < 2) return null;
	const total = activity.reduce((sum, bucket) => sum + bucket.count, 0);
	if (total === 0) return null;
	const peak = Math.max(...activity.map((bucket) => bucket.count));
	const summary = intl.formatMessage({ id: "crowdsec.activity.summary" }, { total, hours: windowHours, peak });
	return (
		<section className="mt-4">
			<div className="text-secondary small mb-2">
				<T id="crowdsec.activity" />
			</div>
			<div className={styles.activityBars} role="img" aria-label={summary}>
				{activity.map((bucket, index) => (
					<span
						key={bucket.start}
						className={index === activity.length - 1 ? styles.activityBarNow : styles.activityBar}
						style={{ height: `${(bucket.count / peak) * 100}%` }}
						title={`${formatDateTime(bucket.start)}: ${intl.formatNumber(bucket.count)}`}
					/>
				))}
			</div>
		</section>
	);
};

export default ActivityStrip;
