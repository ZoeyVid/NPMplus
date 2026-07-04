import { IconHelp, IconSearch } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Alert from "react-bootstrap/Alert";
import { deleteStream, toggleStream, type Stream } from "src/api/backend";
import { Button, HasPermission, LoadingPage } from "src/components";
import { useStreams } from "src/hooks";
import { T } from "src/locale";
import { showDeleteConfirmModal, showHelpModal, showStreamModal } from "src/modals";
import { MANAGE, STREAMS } from "src/modules/Permissions";
import { showObjectSuccess } from "src/notifications";
import Table from "./Table";

export default function TableWrapper() {
	const queryClient = useQueryClient();
	const [search, setSearch] = useState("");
	const [_deleteId, _setDeleteIdd] = useState(0);
	const { isFetching, isLoading, isError, error, data } = useStreams(["owner", "certificate"]);

	if (isLoading) {
		return <LoadingPage />;
	}

	if (isError) {
		return <Alert variant="danger">{error?.message || "Unknown error"}</Alert>;
	}

	const handleDelete = async (id: number) => {
		await deleteStream(id);
		showObjectSuccess("stream", "deleted");
	};

	const handleDisableToggle = async (id: number, enabled: boolean) => {
		await toggleStream(id, enabled);
		queryClient.invalidateQueries({ queryKey: ["streams"] });
		queryClient.invalidateQueries({ queryKey: ["stream", id] });
		showObjectSuccess("stream", enabled ? "enabled" : "disabled");
	};

	const getDirectory = (item: Stream) => {
		const dir = item.meta?.directory;
		return typeof dir === "string" ? dir.trim() : "";
	};

	let filtered = null;
	if (search && data) {
		filtered = data?.filter((item) => {
			const directory = getDirectory(item).toLowerCase();
			return (
				`${item.incomingPort}`.includes(search) ||
				`${item.forwardingPort}`.includes(search) ||
				item.forwardingHost.includes(search) ||
				item.npmplusDescription?.toLowerCase().includes(search.toLowerCase()) ||
				directory.includes(search)
			);
		});
	} else if (search !== "") {
		// this can happen if someone deletes the last item while searching
		setSearch("");
	}

	const displayedStreams = filtered ?? data ?? [];
	const groupingActive = displayedStreams.some((item) => getDirectory(item));

	const sharedTableProps = {
		isFiltered: !!filtered,
		isFetching,
		onEdit: (id: number) => showStreamModal(id),
		onDelete: (id: number) =>
			showDeleteConfirmModal({
				title: <T id="object.delete" tData={{ object: "stream" }} />,
				onConfirm: () => handleDelete(id),
				invalidations: [["streams"], ["stream", id]],
				children: <T id="object.delete.content" tData={{ object: "stream" }} />,
			}),
		onDisableToggle: handleDisableToggle,
		onNew: () => showStreamModal("new"),
	};

	const renderGroups: { name: string; isNoDirectory?: boolean; data: Stream[] }[] = [];
	if (groupingActive) {
		const groups: Record<string, Stream[]> = {};
		for (const stream of displayedStreams) {
			const dir = getDirectory(stream);
			if (!groups[dir]) {
				groups[dir] = [];
			}
			groups[dir].push(stream);
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
						{group.isNoDirectory ? <T id="stream.no-directory" /> : group.name}
					</div>
				</div>
				<Table data={group.data} showHeader={index === 0} {...sharedTableProps} />
			</div>
		))
	) : (
		<Table data={displayedStreams} showHeader={true} {...sharedTableProps} />
	);

	return (
		<div className="card mt-4">
			<div className="card-status-top bg-blue" />
			<div className="card-table">
				<div className="card-header">
					<div className="row w-full">
						<div className="col">
							<h2 className="mt-1 mb-0">
								<T id="streams" />
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
								<Button size="sm" onClick={() => showHelpModal("Streams")}>
									<IconHelp size={20} />
								</Button>
								<HasPermission section={STREAMS} permission={MANAGE} hideError>
									{data?.length ? (
										<Button size="sm" className="btn-blue" onClick={() => showStreamModal("new")}>
											<T id="object.add" tData={{ object: "stream" }} />
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
