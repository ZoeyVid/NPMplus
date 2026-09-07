import Alert from "react-bootstrap/Alert";
import type { useCrowdsecMetrics } from "src/hooks";
import { T } from "src/locale";
import Metric from "./Metric";
import { MetricsSkeleton } from "./LoadingSkeleton";

const SystemMetrics = ({ metrics }: { metrics: ReturnType<typeof useCrowdsecMetrics> }) =>
	!metrics.data ? (
		<MetricsSkeleton />
	) : !metrics.data.available ? (
		<Alert variant="secondary">
			<T id={metrics.data.error || "crowdsec.metrics-unavailable"} />
		</Alert>
	) : (
		<>
			<h3>
				<T id="crowdsec.metrics.title" />
			</h3>
			<div className="row g-3">
				<Metric label={<T id="crowdsec.metrics.bouncer-requests" />} value={metrics.data.bouncerRequests ?? 0} tone="green" />
				<Metric label={<T id="crowdsec.metrics.machine-requests" />} value={metrics.data.machineRequests ?? 0} tone="orange" />
				<Metric
					label={<T id="crowdsec.metrics.parser-rate" />}
					value={
						metrics.data.parserSuccessRate === null || typeof metrics.data.parserSuccessRate === "undefined"
							? "—"
							: `${(metrics.data.parserSuccessRate * 100).toFixed(1)}%`
					}
				/>
				<Metric
					label={<T id="crowdsec.metrics.lapi-latency" />}
					value={
						metrics.data.averageLapiMs === null || typeof metrics.data.averageLapiMs === "undefined"
							? "—"
							: `${metrics.data.averageLapiMs.toFixed(1)} ms`
					}
				/>
			</div>
		</>
	);

export default SystemMetrics;