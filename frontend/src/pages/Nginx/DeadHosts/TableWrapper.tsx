import { IconHelp, IconSearch } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Alert from "react-bootstrap/Alert";
import { deleteDeadHost, toggleDeadHost, type DeadHost } from "src/api/backend";
import { Button, HasPermission, LoadingPage } from "src/components";
import { useDeadHosts } from "src/hooks";
import { T } from "src/locale";
import { showDeadHostModal, showDeleteConfirmModal, showHelpModal } from "src/modals";
import { DEAD_HOSTS, MANAGE } from "src/modules/Permissions";
import { showObjectSuccess } from "src/notifications";
import Table from "./Table";

export default function TableWrapper() {
	const queryClient = useQueryClient();
	const [search, setSearch] = useState("");
	const { isFetching, isLoading, isError, error, data } = useDeadHosts(["owner", "certificate"]);

	if (isLoading) {
		return <LoadingPage />;
	}

	if (isError) {
		return <Alert variant="danger">{error?.message || "Unknown error"}</Alert>;
	}

	const handleDelete = async (id: number) => {
		await deleteDeadHost(id);
		showObjectSuccess("dead-host", "deleted");
	};

	const handleDisableToggle = async (id: number, enabled: boolean) => {
		await toggleDeadHost(id, enabled);
		queryClient.invalidateQueries({ queryKey: ["dead-hosts"] });
		queryClient.invalidateQueries({ queryKey: ["dead-host", id] });
		showObjectSuccess("dead-host", enabled ? "enabled" : "disabled");
	};

	const getDirectory = (item: DeadHost) => {
		const dir = item.meta?.directory;
		return typeof dir === "string" ? dir.trim() : "";
	};

	let filtered = null;
	if (search && data) {
		filtered = data?.filter((item) => {
			const directory = getDirectory(item).toLowerCase();
			return (
				item.domainNames.some((domain: string) => domain.toLowerCase().includes(search)) ||
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
		onEdit: (id: number) => showDeadHostModal(id),
		onDelete: (id: number) =>
			showDeleteConfirmModal({
				title: <T id="object.delete" tData={{ object: "dead-host" }} />,
				onConfirm: () => handleDelete(id),
				invalidations: [["dead-hosts"], ["dead-host", id]],
				children: <T id="object.delete.content" tData={{ object: "dead-host" }} />,
			}),
		onDisableToggle: handleDisableToggle,
		onNew: () => showDeadHostModal("new"),
	};

	const renderGroups: { name: string; isNoDirectory?: boolean; data: DeadHost[] }[] = [];
	if (groupingActive) {
		const groups: Record<string, DeadHost[]> = {};
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
						{group.isNoDirectory ? <T id="dead-host.no-directory" /> : group.name}
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
			<div className="card-status-top bg-red" />
			<div className="card-table">
				<div className="card-header">
					<div className="row w-full">
						<div className="col">
							<h2 className="mt-1 mb-0">
								<T id="dead-hosts" />
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
								<Button size="sm" onClick={() => showHelpModal("DeadHosts")}>
									<IconHelp size={20} />
								</Button>
								<HasPermission section={DEAD_HOSTS} permission={MANAGE} hideError>
									{data?.length ? (
										<Button size="sm" className="btn-red" onClick={() => showDeadHostModal("new")}>
											<T id="object.add" tData={{ object: "dead-host" }} />
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
