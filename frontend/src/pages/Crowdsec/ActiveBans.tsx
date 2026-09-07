import {
	IconChevronDown,
	IconChevronLeft,
	IconChevronRight,
	IconRefresh,
	IconSearch,
	IconTrash,
} from "@tabler/icons-react";
import { Fragment, useDeferredValue, useState } from "react";
import Alert from "react-bootstrap/Alert";
import type { CrowdsecAlert, CrowdsecDecision } from "src/api/backend";
import { Button } from "src/components";
import { useLocaleState } from "src/context";
import { useCrowdsecAlerts, useCrowdsecDecisions, useUnbanCrowdsecDecision } from "src/hooks";
import { formatDateTime, intl, T } from "src/locale";
import { showDeleteConfirmModal, showManualBanModal } from "src/modals";
import { showError } from "src/notifications";
import { TableSkeleton } from "./LoadingSkeleton";
import { decisionTarget } from "./utils";

const AlertContext = ({ decision }: { decision: CrowdsecDecision }) => {
	const { locale } = useLocaleState();
	const query = useCrowdsecAlerts(decision.id, decision.scope, decision.value, true);
	if (query.isFetching && !query.data) return <div className="text-secondary small py-2">…</div>;
	if (query.isError && !query.data)
		return (
			<div className="text-secondary small py-2">
				<T id={query.error?.message || "error.unknown"} />
			</div>
		);
	if (!query.data?.length)
		return (
			<div className="text-secondary small py-2">
				<T id="crowdsec.no-alerts" />
			</div>
		);
	return (
		<div className="py-2">
			{query.data.map((alert: CrowdsecAlert) => (
				<div key={alert.id} className="mb-3">
					<div>
						<span className="badge bg-cyan me-2">{alert.scenario}</span>
						{alert.message}
					</div>
					<div className="text-secondary small">
						{alert.startAt ? formatDateTime(alert.startAt, locale) : null}
					</div>
					{alert.events
						.flatMap((event) => event.meta)
						.map((item, index) => (
							<div key={`${item.key}-${index}`} className="small">
								<span className="text-secondary">{item.key}:</span> {item.value}
							</div>
						))}
				</div>
			))}
		</div>
	);
};

const ActiveBans = () => {
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [expanded, setExpanded] = useState<number | null>(null);
	const deferredSearch = useDeferredValue(search.trim());
	const query = useCrowdsecDecisions(
		{ page, pageSize: 25, search: deferredSearch, origin: "local" },
		{ placeholderData: (previous: unknown) => previous },
	);
	const unban = useUnbanCrowdsecDecision();

	const confirmUnban = (decision: CrowdsecDecision) =>
		showDeleteConfirmModal({
			title: <T id="crowdsec.unban-title" data={{ target: decisionTarget(decision) }} />,
			children: <T id="crowdsec.unban-content" data={{ id: decision.id }} />,
			subject: decisionTarget(decision),
			details: (
				<T
					id="crowdsec.unban-details"
					data={{ origin: decision.origin, scenario: decision.scenario, type: decision.type }}
				/>
			),
			confirmLabel: <T id="crowdsec.unban" />,
			onConfirm: async () => {
				const result = await unban.mutateAsync(decision.id);
				if (!result.auditLogged) showError(intl.formatMessage({ id: "crowdsec.audit-warning" }));
			},
		});

	return (
		<div id="crowdsec-active-bans">
			<div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
				<div>
					<h3 className="mb-1">
						<T id="crowdsec.tabs.bans" />
					</h3>
					<div className="text-secondary small">
						<T id="crowdsec.local-only-help" />
					</div>
				</div>
				<div className="d-flex flex-wrap gap-2">
					<div className="input-group input-group-flat w-auto">
						<span className="input-group-text">
							<IconSearch size={16} />
						</span>
						<input
							className="form-control form-control-sm"
							type="search"
							value={search}
							placeholder={intl.formatMessage({ id: "crowdsec.search" })}
							onChange={(event) => {
								setSearch(event.target.value);
								setPage(1);
							}}
						/>
					</div>
					<Button actionType="danger" onClick={() => showManualBanModal({})}>
						<T id="crowdsec.ban" />
					</Button>
					<Button
						actionType="secondary"
						variant="outline"
						isLoading={query.isFetching}
						onClick={() => query.refetch()}
					>
						<IconRefresh size={16} />
						<span className="visually-hidden">
							<T id="crowdsec.refresh" />
						</span>
					</Button>
				</div>
			</div>
			{query.isError && !query.data ? (
				<Alert variant="danger">
					<T id={query.error?.message || "error.unknown"} />
				</Alert>
			) : !query.data ? (
				<TableSkeleton />
			) : (
				<>
					{query.isError && (
						<Alert variant="warning">
							<T id="crowdsec.stale" /> <T id={query.error?.message || "error.unknown"} />
						</Alert>
					)}
					<div className="table-responsive">
						<table className="table table-vcenter table-striped">
							<thead>
								<tr>
									<th aria-label={intl.formatMessage({ id: "crowdsec.details" })} />
									<th>
										<T id="crowdsec.target" />
									</th>
									<th>
										<T id="crowdsec.reason" />
									</th>
									<th>
										<T id="crowdsec.origin" />
									</th>
									<th>
										<T id="crowdsec.action" />
									</th>
									<th>
										<T id="crowdsec.expires" />
									</th>
									<th />
								</tr>
							</thead>
							<tbody>
								{query.data.items.length === 0 && (
									<tr>
										<td colSpan={7} className="text-center text-secondary py-5">
											<T id={deferredSearch ? "crowdsec.no-matches" : "crowdsec.empty-local"} />
										</td>
									</tr>
								)}
								{query.data.items.map((decision) => {
									const open = expanded === decision.id;
									return (
										<Fragment key={decision.id}>
											<tr>
												<td className="w-1">
													<button
														type="button"
														className="btn btn-sm btn-ghost-secondary"
														aria-expanded={open}
														onClick={() => setExpanded(open ? null : decision.id)}
													>
														<IconChevronDown
															size={16}
															className={open ? "" : "rotate-270"}
														/>
													</button>
												</td>
												<td className="text-break">{decisionTarget(decision)}</td>
												<td className="text-break">{decision.scenario}</td>
												<td>{decision.origin}</td>
												<td>{decision.type}</td>
												<td>
													{decision.duration ? (
														<T
															id="crowdsec.expires-in"
															data={{ duration: decision.duration }}
														/>
													) : (
														<T id="crowdsec.unknown-duration" />
													)}
												</td>
												<td className="text-end">
													<Button
														size="sm"
														actionType="danger"
														onClick={() => confirmUnban(decision)}
													>
														<IconTrash size={16} />
														<T id="crowdsec.unban" />
													</Button>
												</td>
											</tr>
											{open && (
												<tr>
													<td colSpan={7} className="bg-secondary-lt">
														<AlertContext decision={decision} />
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
								disabled={page === 1 || query.isFetching}
								onClick={() => setPage((value) => Math.max(1, value - 1))}
							>
								<IconChevronLeft size={16} />
								<T id="crowdsec.previous" />
							</Button>
							<Button
								actionType="secondary"
								variant="outline"
								disabled={!query.data.hasNext || query.isFetching}
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

export default ActiveBans;
