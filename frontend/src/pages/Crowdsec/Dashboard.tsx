import {
	IconBell,
	IconBellOff,
	IconChevronLeft,
	IconChevronRight,
	IconRefresh,
	IconSearch,
	IconShield,
	IconShieldOff,
} from "@tabler/icons-react";
import {
	Fragment,
	lazy,
	type KeyboardEvent as ReactKeyboardEvent,
	type ReactNode,
	Suspense,
	useDeferredValue,
	useEffect,
	useMemo,
	useState,
} from "react";
import Alert from "react-bootstrap/Alert";
import Modal from "react-bootstrap/Modal";
import type {
	AnubisStatus,
	CrowdsecAlert,
	CrowdsecInsights,
	CrowdsecInsightsItem,
	CrowdsecMetrics,
} from "src/api/backend";
import { Button } from "src/components";
import { useLocaleState } from "src/context";
import { useAnubisStatus, useCrowdsecAlertHistory, useCrowdsecInsights, useCrowdsecMetrics } from "src/hooks";
import { formatDateTime, intl, T } from "src/locale";
import { showManualBanModal } from "src/modals";
import ActiveBans from "./ActiveBans";
import AnimatedLogo from "./AnimatedLogo";
import styles from "./Dashboard.module.css";
import { MetricsSkeleton, OverviewSkeleton, TableSkeleton } from "./LoadingSkeleton";

const AttackMap = lazy(() => import("./AttackMap"));

const NOTIFICATIONS_KEY = "npmplus.crowdsec.browser-notifications";
const LAST_SIGNAL_KEY = "npmplus.crowdsec.last-signal";
type DashboardTab = "overview" | "activity" | "bans" | "waf" | "system";
type KpiKind = "attacks" | "local" | "community" | "anubis";
type BrowserNotificationState = NotificationPermission | "unsupported";

const alertTarget = (alert: CrowdsecAlert) => {
	for (const event of alert.events)
		for (const item of event.meta)
			if (["target_host", "target_fqdn", "target_uri"].includes(item.key)) return item.value;
	return "";
};
const alertSource = (alert: CrowdsecAlert) => alert.source.ip || alert.source.value || alert.source.rdns || "—";

const ActivityChart = ({ items, windowHours }: { items: { start: string; count: number }[]; windowHours: number }) => {
	const width = 720;
	const height = 184;
	const plotHeight = 148;
	const max = Math.max(1, ...items.map((item) => item.count));
	const total = items.reduce((sum, item) => sum + item.count, 0);
	const barWidth = Math.max(1, width / Math.max(1, items.length) - 2);
	const labelIndexes = [...new Set([0, Math.floor((items.length - 1) / 2), items.length - 1])].filter(
		(index) => index >= 0,
	);
	const bucketLabel = (start: string) =>
		intl.formatDate(
			new Date(start),
			windowHours >= 168 ? { month: "short", day: "numeric" } : { hour: "numeric", minute: "2-digit" },
		);
	const summary = intl.formatMessage(
		{ id: "crowdsec.activity.summary" },
		{ total, hours: windowHours, peak: Math.max(0, ...items.map((item) => item.count)) },
	);
	return (
		<figure className="mb-0">
			<svg className={styles.chart} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={summary}>
				<title>{summary}</title>
				<text x="0" y="12" className={styles.chartLabel}>
					{intl.formatNumber(max)}
				</text>
				<line x1="0" y1={plotHeight} x2={width} y2={plotHeight} stroke="currentColor" opacity="0.2" />
				{items.map((item, index) => {
					const barHeight = (item.count / max) * (plotHeight - 18);
					return (
						<rect
							key={item.start}
							x={index * (width / Math.max(1, items.length))}
							y={plotHeight - barHeight}
							width={barWidth}
							height={barHeight}
							rx="2"
							fill="var(--tblr-azure)"
						>
							<title>{`${formatDateTime(item.start)}: ${item.count}`}</title>
						</rect>
					);
				})}
				{labelIndexes.map((index) => (
					<text
						key={items[index].start}
						x={(index / Math.max(1, items.length - 1)) * width}
						y="176"
						textAnchor={index === 0 ? "start" : index === items.length - 1 ? "end" : "middle"}
						className={styles.chartLabel}
					>
						{bucketLabel(items[index].start)}
					</text>
				))}
			</svg>
			{total === 0 && (
				<div className="text-secondary text-center small mt-2">
					<T id="crowdsec.activity.empty" />
				</div>
			)}
			<figcaption className="visually-hidden">
				{summary}
				<ol>
					{items.map((item) => (
						<li key={item.start}>{`${formatDateTime(item.start)}: ${item.count}`}</li>
					))}
				</ol>
			</figcaption>
		</figure>
	);
};

const QuickFilters = ({ items, onSelect }: { items: CrowdsecInsightsItem[]; onSelect: (value: string) => void }) =>
	items.length === 0 ? (
		<span className="text-secondary small">
			<T id="crowdsec.insights.empty" />
		</span>
	) : (
		<div className="d-flex flex-wrap gap-1">
			{items.map((item) => (
				<button
					type="button"
					key={item.name}
					className={`btn btn-sm btn-outline-secondary ${styles.quickFilter}`}
					onClick={() => onSelect(item.name)}
				>
					{item.name} <span className="badge bg-secondary-lt ms-1">{item.count}</span>
				</button>
			))}
		</div>
	);

const Metric = ({
	label,
	value,
	onClick,
	tone = "azure",
	description,
}: {
	label: ReactNode;
	value: string | number;
	onClick?: () => void;
	tone?: string;
	description?: ReactNode;
}) => {
	const content = (
		<>
			<div className={`card-status-start bg-${tone}`} />
			<div className="card-body">
				<div className="d-flex justify-content-between align-items-start gap-2">
					<div className={`${styles.metricLabel} text-secondary text-uppercase small`}>{label}</div>
					{onClick && <IconChevronRight size={16} className="text-secondary" aria-hidden="true" />}
				</div>
				<div className="h2 mb-0 mt-1">{typeof value === "number" ? intl.formatNumber(value) : value}</div>
				<div className={`${styles.metricDescription} text-secondary small mt-2`}>{description}</div>
				{onClick && (
					<span className="visually-hidden">
						<T id="crowdsec.kpi.open" />
					</span>
				)}
			</div>
		</>
	);
	return (
		<div className="col-sm-6 col-xl-3">
			{onClick ? (
				<button
					type="button"
					className={`${styles.metricCard} card card-sm h-100 w-100 text-start`}
					onClick={onClick}
					aria-haspopup="dialog"
				>
					{content}
				</button>
			) : (
				<div className={`${styles.metricCard} card card-sm h-100 w-100 text-start`}>{content}</div>
			)}
		</div>
	);
};

const ItemList = ({ title, items }: { title: ReactNode; items: CrowdsecInsightsItem[] }) => (
	<div className="col-md-6">
		<h4>{title}</h4>
		{items.length ? (
			<div className="list-group list-group-flush">
				{items.map((item) => (
					<div key={item.name} className="list-group-item px-0 d-flex justify-content-between gap-2">
						<span className="text-break">{item.name}</span>
						<span className="badge bg-secondary-lt flex-shrink-0">{item.count}</span>
					</div>
				))}
			</div>
		) : (
			<div className="text-secondary">
				<T id="crowdsec.insights.empty" />
			</div>
		)}
	</div>
);

interface StatusPresentation {
	label: string;
	tone: "green" | "orange" | "red" | "secondary";
}

const anubisServiceStatus = (anubis?: AnubisStatus): StatusPresentation => {
	if (!anubis) return { label: "crowdsec.status.checking", tone: "orange" };
	if (!anubis.configured) return { label: "crowdsec.anubis.service-disabled", tone: "secondary" };
	if (anubis.container.up === true) return { label: "crowdsec.anubis.container-up", tone: "green" };
	if (anubis.container.up === false) return { label: "crowdsec.anubis.container-down", tone: "red" };
	return { label: "crowdsec.status.checking", tone: "orange" };
};

const honeypotStatus = (anubis?: AnubisStatus): StatusPresentation => {
	if (!anubis) return { label: "crowdsec.anubis.honeypot-checking", tone: "orange" };
	if (!anubis.configured || anubis.honeypot.status === "disabled")
		return { label: "crowdsec.anubis.honeypot-disabled", tone: "secondary" };
	if (anubis.container.up === false || anubis.honeypot.status === "unavailable")
		return { label: "crowdsec.anubis.honeypot-unavailable", tone: "red" };
	if (anubis.honeypot.status === "waiting") return { label: "crowdsec.anubis.honeypot-waiting", tone: "orange" };
	return { label: "crowdsec.anubis.honeypot-ready", tone: "green" };
};

const appsecStatus = (metrics?: CrowdsecMetrics): StatusPresentation => {
	if (!metrics) return { label: "crowdsec.appsec.status-checking", tone: "orange" };
	if (metrics.appsecConfigured === false) return { label: "crowdsec.appsec.status-disabled", tone: "secondary" };
	if (metrics.appsecConfigured === true && !metrics.available)
		return { label: "crowdsec.appsec.status-monitoring-unavailable", tone: "orange" };
	if (metrics.appsecMetricsPresent) return { label: "crowdsec.appsec.status-active", tone: "green" };
	if (metrics.appsecConfigured === true) return { label: "crowdsec.appsec.status-ready", tone: "orange" };
	return { label: "crowdsec.appsec.status-unknown", tone: "secondary" };
};

const KpiDetailsModal = ({
	kind,
	insights,
	metrics,
	anubis,
	onClose,
	onNavigate,
}: {
	kind: KpiKind | null;
	insights?: CrowdsecInsights;
	metrics?: CrowdsecMetrics;
	anubis?: AnubisStatus;
	onClose: () => void;
	onNavigate: (tab: DashboardTab) => void;
}) => {
	const titles: Record<KpiKind, string> = {
		attacks: "crowdsec.kpi.attacks",
		local: "crowdsec.kpi.local",
		community: "crowdsec.kpi.community",
		anubis: "crowdsec.kpi.honeypot",
	};
	const serviceStatus = anubisServiceStatus(anubis);
	const trapStatus = honeypotStatus(anubis);
	const navigate = (tab: DashboardTab) => {
		onClose();
		onNavigate(tab);
	};
	return (
		<Modal show={kind !== null} onHide={onClose} size="lg" centered>
			<Modal.Header closeButton>
				<Modal.Title>{kind ? <T id={titles[kind]} /> : null}</Modal.Title>
			</Modal.Header>
			<Modal.Body>
				{kind === "attacks" && (
					<>
						<div className="h2 mb-3">
							{typeof insights?.alertCount === "number" ? intl.formatNumber(insights.alertCount) : "—"}{" "}
							<span className="text-secondary fs-5">
								<T id="crowdsec.insights.alert-count" />
							</span>
						</div>
						<div className="row g-4">
							<ItemList
								title={<T id="crowdsec.insights.scenarios" />}
								items={insights?.topScenarios ?? []}
							/>
							<ItemList
								title={<T id="crowdsec.insights.countries" />}
								items={insights?.topCountries ?? []}
							/>
							<ItemList title={<T id="crowdsec.insights.asns" />} items={insights?.topAsns ?? []} />
							<ItemList title={<T id="crowdsec.insights.targets" />} items={insights?.topTargets ?? []} />
						</div>
					</>
				)}
				{kind === "local" && (
					<>
						<p>
							<T id="crowdsec.kpi.local-help" />
						</p>
						<div className="h1">
							{typeof (metrics?.localActiveDecisions ?? insights?.localActiveDecisions) === "number"
								? intl.formatNumber(
										(metrics?.localActiveDecisions ?? insights?.localActiveDecisions) as number,
									)
								: "—"}
						</div>
					</>
				)}
				{kind === "community" && (
					<>
						<Alert variant="info">
							<T id="crowdsec.kpi.community-help" />
						</Alert>
						<div className="h1">
							{typeof metrics?.communityActiveDecisions === "number"
								? intl.formatNumber(metrics.communityActiveDecisions)
								: "—"}
						</div>
						{metrics?.decisionOrigins
							?.filter((item) => ["capi", "lists"].includes(item.name))
							.map((item) => (
								<div key={item.name} className="d-flex justify-content-between border-top py-2">
									<span>{item.name.toUpperCase()}</span>
									<strong>{intl.formatNumber(item.count)}</strong>
								</div>
							))}
					</>
				)}
				{kind === "anubis" && (
					<>
						<div className="d-flex flex-wrap gap-2 mb-3">
							<span className={`badge bg-${serviceStatus.tone}-lt`}>
								<T id={serviceStatus.label} />
							</span>
							<span className={`badge bg-${trapStatus.tone}-lt`}>
								<T id={trapStatus.label} />
							</span>
						</div>
						<p className="text-secondary">
							<T id="crowdsec.anubis.honeypot-help" />
						</p>
						{typeof anubis?.honeypot.activeCount === "number" ? (
							<div className="h2">
								<T id="crowdsec.anubis.active" data={{ count: anubis.honeypot.activeCount }} />
							</div>
						) : (
							<Alert variant="warning">
								<T id="crowdsec.anubis.decisions-unavailable" />
							</Alert>
						)}
						<h4>
							<T id="crowdsec.anubis.recent" />
						</h4>
						{anubis?.recent.length ? (
							<div>
								{anubis.recent.map((ip) => (
									<span key={ip} className="badge bg-secondary-lt me-1 mb-1">
										{ip}
									</span>
								))}
							</div>
						) : (
							<div className="text-secondary">
								<T id="crowdsec.anubis.recent-empty" />
							</div>
						)}
					</>
				)}
			</Modal.Body>
			<Modal.Footer>
				<Button onClick={onClose}>
					<T id="action.close" />
				</Button>
				{kind === "attacks" && (
					<Button actionType="primary" onClick={() => navigate("activity")}>
						<T id="crowdsec.tabs.activity" />
					</Button>
				)}
				{kind === "local" && (
					<Button actionType="primary" onClick={() => navigate("bans")}>
						<T id="crowdsec.tabs.bans" />
					</Button>
				)}
			</Modal.Footer>
		</Modal>
	);
};

interface HistoryProps {
	windowHours: number;
	page: number;
	setPage: (page: number | ((value: number) => number)) => void;
	search: string;
	setSearch: (value: string) => void;
	scenario: string;
	setScenario: (value: string) => void;
	country: string;
	setCountry: (value: string) => void;
	target: string;
	setTarget: (value: string) => void;
}
const AttackHistory = ({
	windowHours,
	page,
	setPage,
	search,
	setSearch,
	scenario,
	setScenario,
	country,
	setCountry,
	target,
	setTarget,
}: HistoryProps) => {
	const { locale } = useLocaleState();
	const [expanded, setExpanded] = useState<number | null>(null);
	const deferredSearch = useDeferredValue(search);
	const params = useMemo(
		() => ({ page, pageSize: 25, windowHours, search: deferredSearch, scenario, country, target }),
		[page, windowHours, deferredSearch, scenario, country, target],
	);
	const history = useCrowdsecAlertHistory(params, { placeholderData: (previous: unknown) => previous });
	const clear = () => {
		setScenario("");
		setCountry("");
		setTarget("");
		setSearch("");
		setPage(1);
	};
	return (
		<div id="crowdsec-alert-history">
			<div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
				<h3 className="mb-0">
					<T id="crowdsec.history.title" />
				</h3>
				<div className="input-group input-group-flat" style={{ maxWidth: "32rem" }}>
					<span className="input-group-text">
						<IconSearch size={16} />
					</span>
					<input
						id="crowdsec-history-search"
						className="form-control form-control-sm"
						type="search"
						value={search}
						placeholder={intl.formatMessage({ id: "crowdsec.history.search" })}
						onChange={(event) => {
							setSearch(event.target.value);
							setPage(1);
						}}
					/>
				</div>
			</div>
			<div className="d-flex flex-wrap gap-2 mb-3">
				{[scenario, country, target].filter(Boolean).map((value) => (
					<span key={value} className="badge bg-azure-lt text-break">
						{value}
					</span>
				))}
				{(scenario || country || target || search) && (
					<button type="button" className="btn btn-sm btn-outline-secondary" onClick={clear}>
						<T id="crowdsec.filters.clear" />
					</button>
				)}
			</div>
			{history.isError && !history.data ? (
				<Alert variant="danger">
					<T id={history.error?.message || "error.unknown"} />
				</Alert>
			) : !history.data ? (
				<TableSkeleton />
			) : (
				<>
					{history.data.truncated && (
						<Alert variant="info">
							<T id="crowdsec.history.sampled" />
						</Alert>
					)}
					<div className="table-responsive">
						<table className="table table-vcenter table-striped">
							<thead>
								<tr>
									<th>
										<T id="crowdsec.time" />
									</th>
									<th>
										<T id="crowdsec.source" />
									</th>
									<th>
										<T id="crowdsec.reason" />
									</th>
									<th>
										<T id="crowdsec.target" />
									</th>
									<th>
										<T id="crowdsec.events" />
									</th>
									<th />
								</tr>
							</thead>
							<tbody>
								{history.data.items.length === 0 && (
									<tr>
										<td colSpan={6} className="text-center text-secondary py-5">
											<T
												id={
													scenario || country || target || search
														? "crowdsec.no-matches"
														: "crowdsec.history.empty"
												}
											/>
										</td>
									</tr>
								)}
								{history.data.items.map((item) => {
									const open = expanded === item.id;
									return (
										<Fragment key={item.id}>
											<tr>
												<td>
													{item.createdAt || item.startAt
														? formatDateTime(item.createdAt || item.startAt, locale)
														: "—"}
												</td>
												<td className="text-break">{alertSource(item)}</td>
												<td className="text-break">{item.scenario}</td>
												<td className="text-break">{alertTarget(item) || "—"}</td>
												<td>{item.eventsCount}</td>
												<td className="text-end">
													<div className="btn-list justify-content-end">
														<button
															type="button"
															className="btn btn-sm btn-outline-secondary"
															aria-expanded={open}
															onClick={() => setExpanded(open ? null : item.id)}
														>
															<T
																id={
																	open
																		? "crowdsec.collapse-details"
																		: "crowdsec.expand-details"
																}
															/>
														</button>
														{item.source.ip && (
															<Button
																size="sm"
																actionType="danger"
																onClick={() =>
																	showManualBanModal({
																		initialTarget: item.source.ip,
																	})
																}
															>
																<T id="crowdsec.ban" />
															</Button>
														)}
													</div>
												</td>
											</tr>
											{open && (
												<tr>
													<td colSpan={6} className="bg-light">
														<div className="small py-2">
															<div className="mb-2">{item.message}</div>
															{item.events.map((event, index) => (
																<div key={`${item.id}-${index}`} className="mb-2">
																	{event.timestamp && (
																		<div className="text-secondary">
																			{formatDateTime(event.timestamp, locale)}
																		</div>
																	)}
																	{event.meta.map((meta) => (
																		<div key={meta.key}>
																			<span className="text-secondary">
																				{meta.key}:
																			</span>{" "}
																			{meta.value}
																		</div>
																	))}
																</div>
															))}
														</div>
													</td>
												</tr>
											)}
										</Fragment>
									);
								})}
							</tbody>
						</table>
					</div>
					<div className="d-flex align-items-center justify-content-between pt-3 border-top">
						<span className="text-secondary">
							<T id="crowdsec.history.page" data={{ page }} />
						</span>
						<div className="btn-list">
							<Button
								actionType="secondary"
								variant="outline"
								disabled={page === 1 || history.isFetching}
								onClick={() => setPage((value) => Math.max(1, value - 1))}
							>
								<IconChevronLeft size={16} />
								<T id="crowdsec.previous" />
							</Button>
							<Button
								actionType="secondary"
								variant="outline"
								disabled={!history.data.hasNext || history.isFetching}
								onClick={() => setPage((value) => value + 1)}
							>
								<T id="crowdsec.next" />
								<IconChevronRight size={16} />
							</Button>
						</div>
					</div>
				</>
			)}
		</div>
	);
};

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
						{metrics.data.appsecConfigured === false ? (
							<IconShieldOff size={28} />
						) : (
							<IconShield size={28} />
						)}
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
					value={metrics.data.available ? requests : "\u2014"}
					description={<T id="crowdsec.appsec.since-restart" />}
				/>
				<Metric
					label={<T id="crowdsec.appsec.passed" />}
					value={metrics.data.available ? passed : "\u2014"}
					tone="green"
					description={<T id="crowdsec.appsec.passed-help" />}
				/>
				<Metric
					label={<T id="crowdsec.appsec.blocked" />}
					value={metrics.data.available ? blocked : "\u2014"}
					tone="red"
					description={<T id="crowdsec.appsec.blocked-help" />}
				/>
				<Metric
					label={<T id="crowdsec.appsec.block-rate" />}
					value={blockRate === null ? "\u2014" : `${(blockRate * 100).toFixed(1)}%`}
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
										<T
											id={`crowdsec.appsec.failure-${metrics.data.appsecFailureAction || "unknown"}`}
										/>
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
				<Metric
					label={<T id="crowdsec.metrics.bouncer-requests" />}
					value={metrics.data.bouncerRequests ?? 0}
					tone="green"
				/>
				<Metric
					label={<T id="crowdsec.metrics.machine-requests" />}
					value={metrics.data.machineRequests ?? 0}
					tone="orange"
				/>
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

const CrowdsecDashboard = () => {
	const [tab, setTab] = useState<DashboardTab>("overview");
	const [kpi, setKpi] = useState<KpiKind | null>(null);
	const [windowHours, setWindowHours] = useState(24);
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [scenario, setScenario] = useState("");
	const [country, setCountry] = useState("");
	const [target, setTarget] = useState("");
	const [notificationsEnabled, setNotificationsEnabled] = useState(
		() =>
			typeof Notification !== "undefined" &&
			Notification.permission === "granted" &&
			localStorage.getItem(NOTIFICATIONS_KEY) === "true",
	);
	const [notificationPermission, setNotificationPermission] = useState<BrowserNotificationState>(() =>
		typeof Notification === "undefined" ? "unsupported" : Notification.permission,
	);
	const [showNotificationHelp, setShowNotificationHelp] = useState(false);
	const insights = useCrowdsecInsights(windowHours);
	const metrics = useCrowdsecMetrics();
	const anubis = useAnubisStatus();

	useEffect(() => {
		if (!notificationsEnabled || typeof Notification === "undefined" || Notification.permission !== "granted")
			return;
		if (!insights.isError) localStorage.removeItem(`${LAST_SIGNAL_KEY}.lapi`);
		const signal = insights.isError
			? undefined
			: (insights.data?.signals.find((item) => item.type === "attack-spike") ??
				insights.data?.signals.find((item) => item.type === "active-bans"));
		const signalId = signal?.id ?? (insights.isError ? "lapi-unavailable" : "");
		const signalType = insights.isError ? "lapi" : (signal?.type ?? "unknown");
		if (!signalId || localStorage.getItem(`${LAST_SIGNAL_KEY}.${signalType}`) === signalId) return;
		const body = insights.isError
			? intl.formatMessage({ id: "crowdsec.notification.unavailable" })
			: signal?.type === "attack-spike"
				? intl.formatMessage({ id: "crowdsec.notification.spike" })
				: intl.formatMessage({ id: "crowdsec.notification.bans" }, { count: signal?.count ?? 0 });
		const notice = new Notification(intl.formatMessage({ id: "crowdsec.title" }), { body, tag: signalId });
		notice.onclick = () => notice.close();
		localStorage.setItem(`${LAST_SIGNAL_KEY}.${signalType}`, signalId);
	}, [notificationsEnabled, insights.data?.signals, insights.isError]);

	const toggleNotifications = async () => {
		if (notificationsEnabled) {
			localStorage.setItem(NOTIFICATIONS_KEY, "false");
			setNotificationsEnabled(false);
			setShowNotificationHelp(false);
			return;
		}
		if (typeof Notification === "undefined") return;
		const permission =
			Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
		setNotificationPermission(permission);
		if (permission === "granted") {
			localStorage.setItem(NOTIFICATIONS_KEY, "true");
			setNotificationsEnabled(true);
			setShowNotificationHelp(false);
			return;
		}
		localStorage.setItem(NOTIFICATIONS_KEY, "false");
		setShowNotificationHelp(true);
	};
	const quickFilter = (setter: (value: string) => void, value: string) => {
		setter(value);
		setPage(1);
		setTab("activity");
	};
	const refresh = () => Promise.all([insights.refetch(), metrics.refetch(), anubis.refetch()]);
	const tabs: { id: DashboardTab; label: string }[] = [
		{ id: "overview", label: "crowdsec.tabs.overview" },
		{ id: "activity", label: "crowdsec.tabs.activity" },
		{ id: "bans", label: "crowdsec.tabs.bans" },
		{ id: "waf", label: "crowdsec.tabs.waf" },
		{ id: "system", label: "crowdsec.tabs.system" },
	];
	const serviceStatus =
		anubis.isError && !anubis.data
			? { label: "crowdsec.anubis.container-down", tone: "red" as const }
			: anubisServiceStatus(anubis.data);
	const trapStatus =
		anubis.isError && !anubis.data
			? { label: "crowdsec.anubis.honeypot-unavailable", tone: "red" as const }
			: honeypotStatus(anubis.data);
	const crowdsecStatus =
		insights.isError && !insights.data
			? { label: "crowdsec.status.down", tone: "red" }
			: insights.isRefetchError
				? { label: "crowdsec.status.stale", tone: "orange" }
				: { label: "crowdsec.status.up", tone: "green" };
	const wafStatus = appsecStatus(metrics.data);
	const notificationLabel =
		notificationPermission === "unsupported"
			? "crowdsec.notifications.unsupported"
			: notificationPermission === "denied"
				? "crowdsec.notifications.blocked"
				: notificationsEnabled
					? "crowdsec.notifications.on"
					: "crowdsec.notifications.off";
	const partialRefreshFailed = insights.isRefetchError || metrics.isRefetchError || anubis.isRefetchError;
	const secondarySourceUnavailable = (metrics.isError && !metrics.data) || (anubis.isError && !anubis.data);
	const metricsDegraded = metrics.data && metrics.data.available === false;
	const lastUpdatedAt = Math.max(
		insights.data ? insights.dataUpdatedAt : 0,
		metrics.data ? metrics.dataUpdatedAt : 0,
		anubis.data ? anubis.dataUpdatedAt : 0,
	);
	const moveTabFocus = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
		let nextIndex: number | undefined;
		if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
		if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
		if (event.key === "Home") nextIndex = 0;
		if (event.key === "End") nextIndex = tabs.length - 1;
		if (nextIndex === undefined) return;
		event.preventDefault();
		setTab(tabs[nextIndex].id);
		document.getElementById(`crowdsec-tab-${tabs[nextIndex].id}`)?.focus();
	};

	return (
		<>
			<div className="card mt-4 overflow-visible">
				<div className="card-status-top bg-azure" />
				<div className={`${styles.toolbar} sticky-top bg-body border-bottom`}>
					<div className="card-header border-0">
						<div className="row w-100 align-items-center g-2">
							<div className="col-12 col-md">
								<h2 className="card-title d-flex align-items-center gap-2">
									<AnimatedLogo size="compact" />
									<T id="crowdsec.dashboard" />
								</h2>
								<div className="d-flex flex-wrap align-items-center gap-2 mt-1">
									<span className={`badge bg-${crowdsecStatus.tone}-lt`}>
										<T id={crowdsecStatus.label} />
									</span>
									<span className={`badge bg-${wafStatus.tone}-lt`}>
										<T id={wafStatus.label} />
									</span>
									<span className={`badge bg-${serviceStatus.tone}-lt`}>
										<T id={serviceStatus.label} />
									</span>
									<span className={`badge bg-${trapStatus.tone}-lt`}>
										<T id={trapStatus.label} />
									</span>
									{lastUpdatedAt > 0 && (
										<span className="text-secondary small">
											<T
												id="crowdsec.last-updated"
												data={{ date: formatDateTime(new Date(lastUpdatedAt).toISOString()) }}
											/>
										</span>
									)}
								</div>
							</div>
							<div className={`${styles.controls} col-12 col-md-auto d-flex gap-2`}>
								<select
									className="form-select form-select-sm w-auto"
									aria-label={intl.formatMessage({ id: "crowdsec.window" })}
									value={windowHours}
									onChange={(event) => {
										setWindowHours(Number(event.target.value));
										setPage(1);
									}}
								>
									<option value={1}>1h</option>
									<option value={6}>6h</option>
									<option value={24}>24h</option>
									<option value={168}>7d</option>
								</select>
								<Button
									actionType="secondary"
									variant="outline"
									disabled={notificationPermission === "unsupported"}
									aria-pressed={notificationsEnabled}
									aria-label={intl.formatMessage({ id: notificationLabel })}
									onClick={toggleNotifications}
								>
									{notificationsEnabled ? <IconBell size={16} /> : <IconBellOff size={16} />}
									<span className={`${styles.notificationText} ms-1`}>
										<T id={notificationLabel} />
									</span>
								</Button>
								<Button actionType="danger" onClick={() => showManualBanModal({})}>
									<T id="crowdsec.ban" />
								</Button>
								<Button
									actionType="secondary"
									variant="outline"
									isLoading={insights.isFetching || metrics.isFetching || anubis.isFetching}
									aria-label={intl.formatMessage({ id: "crowdsec.refresh" })}
									onClick={refresh}
								>
									<IconRefresh size={16} />
									<span className="visually-hidden">
										<T id="crowdsec.refresh" />
									</span>
								</Button>
							</div>
						</div>
					</div>
					<div className={`${styles.tabScroller} px-3`}>
						<div
							className={`${styles.tabs} nav nav-tabs card-header-tabs`}
							role="tablist"
							aria-label={intl.formatMessage({ id: "crowdsec.tabs.label" })}
						>
							{tabs.map((item, index) => (
								<div className="nav-item" key={item.id}>
									<button
										id={`crowdsec-tab-${item.id}`}
										type="button"
										role="tab"
										aria-selected={tab === item.id}
										aria-controls="crowdsec-tab-panel"
										tabIndex={tab === item.id ? 0 : -1}
										className={`nav-link ${tab === item.id ? "active" : ""}`}
										onClick={() => setTab(item.id)}
										onKeyDown={(event) => moveTabFocus(event, index)}
									>
										<T id={item.label} />
									</button>
								</div>
							))}
						</div>
					</div>
				</div>
				<div
					id="crowdsec-tab-panel"
					className="card-body"
					role="tabpanel"
					aria-labelledby={`crowdsec-tab-${tab}`}
				>
					{showNotificationHelp && notificationPermission === "denied" && (
						<Alert variant="warning" dismissible onClose={() => setShowNotificationHelp(false)}>
							<T id="crowdsec.notifications.blocked-help" />
						</Alert>
					)}
					{partialRefreshFailed && (
						<Alert variant="warning">
							<T id="crowdsec.partial-refresh" />
						</Alert>
					)}
					{secondarySourceUnavailable && (
						<Alert variant="warning">
							<T id="crowdsec.partial-unavailable" />
						</Alert>
					)}
					{metricsDegraded && (
						<Alert variant="warning">
							<T id={metrics.data?.error || "crowdsec.metrics-unavailable"} />
						</Alert>
					)}
					{insights.isError && !insights.data && (
						<Alert variant="danger">
							<T id="crowdsec.insights.error" />: <T id={insights.error?.message || "error.unknown"} />
						</Alert>
					)}
					{tab === "overview" &&
						(!insights.data ? (
							<OverviewSkeleton />
						) : (
							<>
								{insights.data.signals.some((signal) => signal.type === "attack-spike") && (
									<Alert variant="warning">
										<T id="crowdsec.spike-warning" />
									</Alert>
								)}
								<div className="row g-3 mb-4">
									<Metric
										label={<T id="crowdsec.kpi.attacks" />}
										value={insights.data.alertCount}
										description={<T id="crowdsec.kpi.attacks-hint" data={{ hours: windowHours }} />}
										onClick={() => setKpi("attacks")}
									/>
									<Metric
										label={<T id="crowdsec.kpi.local" />}
										value={
											metrics.data?.localActiveDecisions ??
											insights.data.localActiveDecisions ??
											"—"
										}
										tone="red"
										description={<T id="crowdsec.kpi.local-hint" />}
										onClick={() => setKpi("local")}
									/>
									<Metric
										label={<T id="crowdsec.kpi.community" />}
										value={metrics.data?.communityActiveDecisions ?? "—"}
										tone="green"
										description={
											<T
												id={
													metrics.data?.communityActiveDecisions !== undefined
														? "crowdsec.kpi.community-hint"
														: metrics.data?.available === false
															? "crowdsec.kpi.community-metrics-degraded"
															: "crowdsec.kpi.community-metrics-loading"
												}
											/>
										}
										onClick={() => setKpi("community")}
									/>
									<Metric
										label={<T id="crowdsec.kpi.honeypot" />}
										value={anubis.data?.honeypot.activeCount ?? "—"}
										tone={trapStatus.tone}
										description={<T id={trapStatus.label} />}
										onClick={() => setKpi("anubis")}
									/>
								</div>
								<div className="row g-4">
									<div className="col-lg-7">
										<h3>
											<T id="crowdsec.activity" />
										</h3>
										<ActivityChart items={insights.data.activity} windowHours={windowHours} />
									</div>
									<div className="col-lg-5">
										<h3>
											<T id="crowdsec.attack-map" />
										</h3>
										{insights.data.locations.length ? (
											<Suspense fallback={<TableSkeleton />}>
												<AttackMap items={insights.data.locations} />
											</Suspense>
										) : (
											<div className="text-secondary py-5 text-center">
												<T id="crowdsec.location-empty" />
											</div>
										)}
									</div>
								</div>
								<div className="row g-3 mt-1">
									<div className="col-lg-3">
										<div className="text-secondary small mb-2">
											<T id="crowdsec.insights.scenarios" />
										</div>
										<QuickFilters
											items={insights.data.topScenarios}
											onSelect={(value) => quickFilter(setScenario, value)}
										/>
									</div>
									<div className="col-lg-3">
										<div className="text-secondary small mb-2">
											<T id="crowdsec.insights.countries" />
										</div>
										<QuickFilters
											items={insights.data.topCountries}
											onSelect={(value) => quickFilter(setCountry, value)}
										/>
									</div>
									<div className="col-lg-3">
										<div className="text-secondary small mb-2">
											<T id="crowdsec.insights.asns" />
										</div>
										<QuickFilters
											items={insights.data.topAsns}
											onSelect={(value) => quickFilter(setSearch, value)}
										/>
									</div>
									<div className="col-lg-3">
										<div className="text-secondary small mb-2">
											<T id="crowdsec.insights.targets" />
										</div>
										<QuickFilters
											items={insights.data.topTargets}
											onSelect={(value) => quickFilter(setTarget, value)}
										/>
									</div>
								</div>
							</>
						))}
					{tab === "activity" && (
						<AttackHistory
							{...{
								windowHours,
								page,
								setPage,
								search,
								setSearch,
								scenario,
								setScenario,
								country,
								setCountry,
								target,
								setTarget,
							}}
						/>
					)}
					{tab === "bans" && <ActiveBans />}
					{tab === "waf" && <WafMonitoring metrics={metrics} />}
					{tab === "system" && <SystemMetrics metrics={metrics} />}
				</div>
			</div>
			<KpiDetailsModal
				kind={kpi}
				insights={insights.data}
				metrics={metrics.data}
				anubis={anubis.data}
				onClose={() => setKpi(null)}
				onNavigate={setTab}
			/>
		</>
	);
};

export default CrowdsecDashboard;
