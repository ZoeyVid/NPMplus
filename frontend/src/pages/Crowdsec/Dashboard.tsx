import { IconBell, IconBellOff, IconRefresh } from "@tabler/icons-react";
import { lazy, type KeyboardEvent as ReactKeyboardEvent, Suspense, useEffect, useState } from "react";
import Alert from "react-bootstrap/Alert";
import type { CrowdsecInsightsItem } from "src/api/backend";
import { Button } from "src/components";
import { useAnubisStatus, useCrowdsecInsights, useCrowdsecMetrics } from "src/hooks";
import { formatDateTime, intl, T } from "src/locale";
import ActiveBans from "./ActiveBans";
import ActivityStrip from "./ActivityStrip";
import AnimatedLogo from "./AnimatedLogo";
import AppsecSummary from "./AppsecSummary";
import AttackHistory from "./AttackHistory";
import AttackMix from "./AttackMix";
import styles from "./Dashboard.module.css";
import KpiDetailsModal from "./KpiDetailsModal";
import { OverviewSkeleton, TableSkeleton } from "./LoadingSkeleton";
import Metric from "./Metric";
import SystemMetrics from "./SystemMetrics";
import type { DashboardTab, KpiKind } from "./shared";
import { anubisServiceStatus, appsecStatus, honeypotStatus } from "./shared";
import WafMonitoring from "./WafMonitoring";

const AttackMap = lazy(() => import("./AttackMap"));

const NOTIFICATIONS_KEY = "npmplus.crowdsec.browser-notifications";
const LAST_SIGNAL_KEY = "npmplus.crowdsec.last-signal";
type BrowserNotificationState = NotificationPermission | "unsupported";

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
										value={
											insights.data.sampled
												? `${insights.data.alertCount}+`
												: insights.data.alertCount
										}
										description={<T id="crowdsec.kpi.attacks-hint" data={{ hours: windowHours }} />}
										onClick={() => setKpi("attacks")}
									/>
									<Metric
										label={<T id="crowdsec.kpi.local" />}
										value={
											insights.data.localActiveDecisions ??
											metrics.data?.localActiveDecisions ??
											"—"
										}
										tone="red"
										description={
											metrics.data?.available === false ||
											metrics.data?.bouncerRequests === undefined ? (
												<T id="crowdsec.kpi.local-hint" />
											) : (metrics.data.bouncerDecisionHits ?? 0) > 0 ? (
												<T
													id="crowdsec.kpi.bouncer-hits"
													data={{ count: metrics.data.bouncerDecisionHits }}
												/>
											) : metrics.data.bouncerRequests > 0 ? (
												<T
													id="crowdsec.kpi.bouncer-pulls"
													data={{ count: metrics.data.bouncerRequests }}
												/>
											) : (
												<T id="crowdsec.kpi.bouncer-idle" />
											)
										}
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
									<div className="col-lg-4">
										<h3>
											<T id="crowdsec.attack-mix" />
										</h3>
										<AttackMix
											items={insights.data.topScenarios}
											total={insights.data.alertCount}
											sampled={insights.data.sampled}
											windowHours={windowHours}
											onSelect={(value) => quickFilter(setScenario, value)}
										/>
										<ActivityStrip activity={insights.data.activity} windowHours={windowHours} />
									</div>
									<div className="col-lg-3">
										<h3>
											<T id="crowdsec.tabs.waf" />
										</h3>
										<AppsecSummary metrics={metrics} onOpen={() => setTab("waf")} />
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
									<div className="col-lg">
										<div className="text-secondary small mb-2">
											<T id="crowdsec.insights.scenarios" />
										</div>
										<QuickFilters
											items={insights.data.topScenarios}
											onSelect={(value) => quickFilter(setScenario, value)}
										/>
									</div>
									<div className="col-lg">
										<div className="text-secondary small mb-2">
											<T id="crowdsec.insights.countries" />
										</div>
										<QuickFilters
											items={insights.data.topCountries}
											onSelect={(value) => quickFilter(setCountry, value)}
										/>
									</div>
									<div className="col-lg">
										<div className="text-secondary small mb-2">
											<T id="crowdsec.insights.asns" />
										</div>
										<QuickFilters
											items={insights.data.topAsns}
											onSelect={(value) => quickFilter(setSearch, value)}
										/>
									</div>
									<div className="col-lg">
										<div className="text-secondary small mb-2">
											<T id="crowdsec.insights.ips" />
										</div>
										<QuickFilters
											items={insights.data.topIps}
											onSelect={(value) => quickFilter(setSearch, value)}
										/>
									</div>
									<div className="col-lg">
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
