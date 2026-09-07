import { IconChevronRight } from "@tabler/icons-react";
import type { useCrowdsecMetrics } from "src/hooks";
import { intl, T } from "src/locale";
import styles from "./Dashboard.module.css";
import { appsecStatus } from "./shared";

// compact AppSec verdict on the overview: how many requests were inspected,
// how many were blocked, and a pass/blocked traffic bar. answers "is the WAF
// really blocking or just watching" without a tab switch
const AppsecSummary = ({ metrics, onOpen }: { metrics: ReturnType<typeof useCrowdsecMetrics>; onOpen: () => void }) => {
	const data = metrics.data;
	if (!data)
		return (
			<div className="text-secondary small py-5 text-center">
				<T id="crowdsec.appsec.status-checking" />
			</div>
		);
	const status = appsecStatus(data);
	const requests = data.appsecRequests ?? 0;
	const blocked = data.appsecBlocked ?? 0;
	const passed = data.appsecPassed ?? Math.max(0, requests - blocked);
	const blockRate = data.appsecBlockRate ?? (requests > 0 ? blocked / requests : null);
	const blockedWidth = blockRate === null ? 0 : Math.min(100, Math.max(0, blockRate * 100));
	const passedWidth = requests > 0 ? 100 - blockedWidth : 0;
	const summary = intl.formatMessage({ id: "crowdsec.appsec.traffic-summary" }, { requests, blocked, passed });
	return (
		<button
			type="button"
			className={`${styles.metricCard} card card-sm w-100 text-start`}
			onClick={onOpen}
			aria-haspopup="dialog"
		>
			<div className={`card-status-start bg-${status.tone}`} />
			<div className="card-body">
				<div className="d-flex justify-content-between align-items-start gap-2">
					<div className={`${styles.metricLabel} text-secondary text-uppercase small`}>
						<T id="crowdsec.appsec.blocked" />
					</div>
					<IconChevronRight size={16} className="text-secondary" aria-hidden="true" />
				</div>
				<div className="h2 mb-0 mt-1">{data.available ? intl.formatNumber(blocked) : "—"}</div>
				<div className={`${styles.metricDescription} text-secondary small mt-2`}>
					{data.appsecConfigured === false ? (
						<T id="crowdsec.appsec.status-disabled" />
					) : (
						<T id={status.label} />
					)}
				</div>
				<div className={`${styles.wafTraffic} mt-3`} role="img" aria-label={summary}>
					{requests > 0 ? (
						<>
							<span className={styles.wafPassed} style={{ width: `${passedWidth}%` }} />
							<span className={styles.wafBlocked} style={{ width: `${blockedWidth}%` }} />
						</>
					) : (
						<span className={styles.wafEmpty} />
					)}
				</div>
				<div className="d-flex flex-wrap gap-3 mt-2 small">
					<span className={styles.wafLegendItem}>
						<span className={`${styles.wafLegendDot} bg-green`} aria-hidden="true" />
						<T id="crowdsec.appsec.passed" />: {intl.formatNumber(passed)}
					</span>
					<span className={styles.wafLegendItem}>
						<span className={`${styles.wafLegendDot} bg-red`} aria-hidden="true" />
						<T id="crowdsec.appsec.blocked" />: {intl.formatNumber(blocked)}
					</span>
				</div>
				<span className="visually-hidden">
					<T id="crowdsec.kpi.open" />
				</span>
			</div>
		</button>
	);
};

export default AppsecSummary;
