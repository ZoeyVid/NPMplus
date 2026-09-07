import { IconShield, IconShieldOff } from "@tabler/icons-react";
import Alert from "react-bootstrap/Alert";
import type { useCrowdsecMetrics } from "src/hooks";
import { intl, T } from "src/locale";
import Metric from "./Metric";
import styles from "./Dashboard.module.css";
import { MetricsSkeleton } from "./LoadingSkeleton";
import { appsecStatus } from "./shared";

const WafMonitoring = ({ metrics }: { metrics: ReturnType<typeof useCrowdsecMetrics> }) => {
	if (!metrics.data) return <MetricsSkeleton />;

	const status = appsecStatus(metrics.data);
	const requests = metrics.data.appsecRequests ?? 0;
	const blocked = metrics.data.appsecBlocked ?? 0;
	const passed = metrics.data.appsecPassed ?? Math.max(0, requests - blocked);
	const blockRate = metrics.data.appsecBlockRate ?? (requests > 0 ? blocked / requests : null);
	const blockedWidth = blockRate === null ? 0 : Math.min(100, Math.max(0, blockRate * 100));
	const passedWidth = requests > 0 ? 100 - blockedWidth : 0;
	const summary = intl.formatMessage({ id: "crowdsec.appsec.traffic-summary" }, { requests, blocked, passed });

	return (
		<div className={styles.wafPanel}>
			<section className={`${styles.wafHero} card`} aria-labelledby="appsec-monitor-title">
				<div className="card-body d-flex align-items-start gap-3">
					<div className={`${styles.wafIcon} bg-${status.tone}-lt text-${status.tone}`} aria-hidden="true">
						{metrics.data.appsecConfigured === false ? <IconShieldOff size={28} /> : <IconShield size={28} />}
					</div>
					<div className="flex-fill min-w-0">
						<div className="d-flex flex-wrap align-items-center gap-2 mb-1">
							<h3 id="appsec-monitor-title" className="mb-0">
								<T id="crowdsec.appsec.title" />
							</h3>
							<span className={`badge bg-${status.tone}-lt`}>
								<T id={status.label} />
							</span>
						</div>
						<p className="text-secondary mb-0">
							<T id="crowdsec.appsec.description" />
						</p>
					</div>
				</div>
			</section>

			{metrics.data.appsecConfigured === false && (
				<Alert variant="warning">
					<T id="crowdsec.appsec.enable-help" /> <code>--update --enable-appsec</code>
				</Alert>
			)}
			{!metrics.data.available && (
				<Alert variant="secondary">
					<T id={metrics.data.error || "crowdsec.metrics-unavailable"} />
				</Alert>
			)}

			<div className="row g-3">
				<Metric
					label={<T id="crowdsec.appsec.inspected" />}
					value={metrics.data.available ? requests : "—"}
					description={<T id="crowdsec.appsec.since-restart" />}
				/>
				<Metric
					label={<T id="crowdsec.appsec.passed" />}
					value={metrics.data.available ? passed : "—"}
					tone="green"
					description={<T id="crowdsec.appsec.passed-help" />}
				/>
				<Metric
					label={<T id="crowdsec.appsec.blocked" />}
					value={metrics.data.available ? blocked : "—"}
					tone="red"
					description={<T id="crowdsec.appsec.blocked-help" />}
				/>
				<Metric
					label={<T id="crowdsec.appsec.block-rate" />}
					value={blockRate === null ? "—" : `${(blockRate * 100).toFixed(1)}%`}
					tone="orange"
					description={<T id="crowdsec.appsec.block-rate-help" />}
				/>
			</div>

			<section className="card" aria-labelledby="appsec-traffic-title">
				<div className="card-body">
					<div className="d-flex justify-content-between align-items-baseline gap-3 mb-3">
						<h3 id="appsec-traffic-title" className="mb-0">
							<T id="crowdsec.appsec.traffic" />
						</h3>
						<span className="text-secondary small">
							<T id="crowdsec.appsec.since-restart" />
						</span>
					</div>
					<div className={styles.wafTraffic} role="img" aria-label={summary}>
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
							<span className={`${styles.wafLegendDot} bg-green`} />
							<T id="crowdsec.appsec.passed" />: {intl.formatNumber(passed)}
						</span>
						<span className={styles.wafLegendItem}>
							<span className={`${styles.wafLegendDot} bg-red`} />
							<T id="crowdsec.appsec.blocked" />: {intl.formatNumber(blocked)}
						</span>
					</div>
				</div>
			</section>

			<div className="row g-3">
				<div className="col-lg-6">
					<section className="card h-100" aria-labelledby="appsec-policy-title">
						<div className="card-body">
							<h3 id="appsec-policy-title">
								<T id="crowdsec.appsec.policy" />
							</h3>
							<div className={styles.wafPolicyList}>
								<div>
									<strong>
										<T id="crowdsec.appsec.rules" />
									</strong>
									<span className="text-secondary">
										<T id="crowdsec.appsec.rules-default" />
									</span>
								</div>
								<div>
									<strong>
										<T id="crowdsec.appsec.failure-mode" />
									</strong>
									<span className="text-secondary">
										<T id={`crowdsec.appsec.failure-${metrics.data.appsecFailureAction || "unknown"}`} />
									</span>
								</div>
								<div>
									<strong>
										<T id="crowdsec.appsec.unreadable-body" />
									</strong>
									<span className="text-secondary">
										<T
											id={
												metrics.data.appsecDropUnreadableBody === true
													? "crowdsec.appsec.unreadable-drop"
													: metrics.data.appsecDropUnreadableBody === false
														? "crowdsec.appsec.unreadable-allow"
														: "crowdsec.appsec.unknown"
											}
										/>
									</span>
								</div>
							</div>
						</div>
					</section>
				</div>
				<div className="col-lg-6">
					<section className="card h-100" aria-labelledby="appsec-compatibility-title">
						<div className="card-body">
							<h3 id="appsec-compatibility-title">
								<T id="crowdsec.appsec.compatibility" />
							</h3>
							<p className="text-secondary">
								<T id="crowdsec.appsec.compatibility-help" />
							</p>
							<Alert variant="info" className="mb-0">
								<T id="crowdsec.appsec.host-toggle-help" />
							</Alert>
						</div>
					</section>
				</div>
			</div>
		</div>
	);
};

export default WafMonitoring;