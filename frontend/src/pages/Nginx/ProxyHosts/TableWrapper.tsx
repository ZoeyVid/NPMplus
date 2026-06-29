import { IconHelp, IconSearch } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import type { SortingState } from "@tanstack/react-table";
import { useState } from "react";
import Alert from "react-bootstrap/Alert";
import { deleteProxyHost, type ProxyHost, toggleProxyHost } from "src/api/backend";
import { Button, HasPermission, LoadingPage } from "src/components";
import { useProxyHosts } from "src/hooks";
import { T } from "src/locale";
import { showDeleteConfirmModal, showHelpModal, showProxyHostModal } from "src/modals";
import { MANAGE, PROXY_HOSTS } from "src/modules/Permissions";
import { showObjectSuccess } from "src/notifications";
import Table from "./Table";

export default function TableWrapper() {
	const queryClient = useQueryClient();
	const [search, setSearch] = useState("");
	const [sorting, setSorting] = useState<SortingState>([]);
	const { isFetching, isLoading, isError, error, data } = useProxyHosts(["owner", "access_lists", "certificate"]);

	if (isLoading) {
		return <LoadingPage />;
	}

	if (isError) {
		return <Alert variant="danger">{error?.message || "Unknown error"}</Alert>;
	}

	const handleDelete = async (id: number) => {
		await deleteProxyHost(id);
		showObjectSuccess("proxy-host", "deleted");
	};

	const handleDisableToggle = async (id: number, enabled: boolean) => {
		await toggleProxyHost(id, enabled);
		queryClient.invalidateQueries({ queryKey: ["proxy-hosts"] });
		queryClient.invalidateQueries({ queryKey: ["proxy-host", id] });
		showObjectSuccess("proxy-host", enabled ? "enabled" : "disabled");
	};

	const handleDeleteClick = (id: number) => {
		const host = data?.find((h) => h.id === id);
		showDeleteConfirmModal({
			title: <T id="object.delete" tData={{ object: "proxy-host" }} />,
			onConfirm: () => handleDelete(id),
			invalidations: [["proxy-hosts"], ["proxy-host", id]],
			children: (
				<>
					<T id="object.delete.content" tData={{ object: "proxy-host" }} />
					{host?.domainNames?.length ? (
						<div className="mt-2 fw-bold text-break">{host.domainNames.join(", ")}</div>
					) : null}
					{host?.forwardHost ? (
						<div className="mt-1 text-muted small">
							({host.forwardScheme}://{host.forwardHost}:{host.forwardPort})
						</div>
					) : null}
				</>
			),
		});
	};

	const getDirectory = (item: ProxyHost) => {
		const dir = item.meta?.directory;
		return typeof dir === "string" ? dir.trim() : "";
	};

	let filtered = null;
	if (search && data) {
		filtered = data?.filter((item) => {
			const directory = getDirectory(item).toLowerCase();
			return (
				item.domainNames.some((domain: string) => domain.toLowerCase().includes(search)) ||
				item.forwardHost.toLowerCase().includes(search) ||
				`${item.forwardPort}`.includes(search) ||
				directory.includes(search)
			);
		});
	} else if (search !== "") {
		// this can happen if someone deletes the last item while searching
		setSearch("");
	}

	const displayedHosts = filtered ?? data ?? [];
	const groupingActive = displayedHosts.some((item) => getDirectory(item));

	const sharedTableProps = {
		isFiltered: !!search,
		isFetching,
		sorting,
		onSortingChange: setSorting,
		onEdit: (id: number) => showProxyHostModal(id),
		onClone: (id: number) => showProxyHostModal(id, true),
		onDelete: handleDeleteClick,
		onDisableToggle: handleDisableToggle,
		onNew: () => showProxyHostModal("new"),
	};

	const renderGroups: { name: string; isNoDirectory?: boolean; data: ProxyHost[] }[] = [];
	if (groupingActive) {
		const groups: Record<string, ProxyHost[]> = {};
		for (const host of displayedHosts) {
			const dir = getDirectory(host);
			if (!groups[dir]) {
				groups[dir] = [];
			}
			groups[dir].push(host);
		}

		const sortedDirs = Object.keys(groups)
			.filter((dir) => dir !== "")
			.sort((a, b) => a.localeCompare(b));

		for (const dir of sortedDirs) {
			renderGroups.push({ name: dir, data: groups[dir] });
		}
		if (groups[""] && groups[""].length > 0) {
			renderGroups.push({ name: "", isNoDirectory: true, data: groups[""] });
		}
	}

	const renderedTables = groupingActive ? (
		renderGroups.map((group, index) => (
			<div key={group.isNoDirectory ? "no-directory" : `dir-${group.name}`}>
				<div
					className="card-header py-2 border-top border-bottom"
					style={{ backgroundColor: "var(--tblr-bg-surface-secondary)" }}
				>
					<div
						className="fw-bold text-secondary text-uppercase"
						style={{ fontSize: "0.75rem", letterSpacing: "0.05em" }}
					>
						{group.isNoDirectory ? <T id="proxy-host.no-directory" /> : group.name}
					</div>
				</div>
				<Table data={group.data} showHeader={index === 0} {...sharedTableProps} />
			</div>
		))
	) : (
		<Table data={displayedHosts} showHeader={true} {...sharedTableProps} />
	);

	return (
		<div className="card mt-4">
			<div className="card-status-top bg-lime" />
			<div className="card-table">
				<div className="card-header">
					<div className="row w-full">
						<div className="col">
							<h2 className="mt-1 mb-0">
								<T id="proxy-hosts" />
							</h2>
						</div>
						<div className="col-md-auto col-sm-12">
							<div className="ms-auto d-flex flex-wrap btn-list">
								{data?.length ? (
									<div className="input-group input-group-flat w-auto">
										<span className="input-group-text input-group-text-sm">
											<IconSearch size={16} />
										</span>
										<input
											id="advanced-table-search"
											type="text"
											className="form-control form-control-sm"
											autoComplete="off"
											onChange={(e: any) => setSearch(e.target.value.toLowerCase().trim())}
										/>
									</div>
								) : null}
								<Button size="sm" onClick={() => showHelpModal("ProxyHosts")}>
									<IconHelp size={20} />
								</Button>
								<HasPermission section={PROXY_HOSTS} permission={MANAGE} hideError>
									{data?.length ? (
										<Button
											size="sm"
											className="btn-lime"
											onClick={() => showProxyHostModal("new")}
										>
											<T id="object.add" tData={{ object: "proxy-host" }} />
										</Button>
									) : null}
								</HasPermission>
							</div>
						</div>
					</div>
				</div>
				{renderedTables}
			</div>
		</div>
	);
}
