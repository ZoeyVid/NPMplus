import {
	IconChevronLeft,
	IconChevronRight,
	IconChevronsLeft,
	IconChevronsRight,
	IconSearch,
} from "@tabler/icons-react";
import { useState } from "react";
import Alert from "react-bootstrap/Alert";
import { LoadingPage } from "src/components";
import { useAuditLogs } from "src/hooks";
import { T } from "src/locale";
import { showEventDetailsModal } from "src/modals";
import Table from "./Table";

export default function TableWrapper() {
	const [search, setSearch] = useState("");
	const [page, setPage] = useState(0);
	const [pageSize, setPageSize] = useState(25);
	const { isFetching, isPending, isError, error, data } = useAuditLogs(["user"], page, pageSize, search);

	if (isPending) {
		return <LoadingPage />;
	}

	if (isError) {
		return <Alert variant="danger">{error?.message}</Alert>;
	}

	const pages = Math.ceil(data.total / pageSize);
	const goTo = (target) => {
		setPage(target);
	};

	return (
		<div className="card mt-4">
			<div className="card-status-top bg-purple" />
			<div className="card-table">
				<div className="card-header">
					<div className="row w-full">
						<div className="col">
							<h2 className="mt-1 mb-0">
								<T id="auditlogs" />
							</h2>
						</div>
						{data.results.length || search ? (
							<div className="col-md-auto col-sm-12">
								<div className="ms-auto d-flex flex-wrap btn-list">
									<div className="input-group input-group-flat w-auto">
										<span className="input-group-text input-group-text-sm">
											<IconSearch size={16} />
										</span>
										<input
											type="text"
											className="form-control form-control-sm"
											autoComplete="off"
											onChange={(e) => {
												setSearch(e.target.value.trim());
												setPage(0);
											}}
										/>
									</div>
								</div>
							</div>
						) : null}
					</div>
				</div>
				<Table data={data.results} isFetching={isFetching} onSelectItem={showEventDetailsModal} />
				{data.total > 25 ? (
					<div className="card-footer d-flex align-items-center justify-content-end gap-2">
						<select
							className="form-select form-select-sm w-auto me-auto"
							value={pageSize}
							onChange={(e) => {
								const size = Number(e.target.value);
								setPage(Math.floor((page * pageSize) / size));
								setPageSize(size);
							}}
						>
							{[25, 50, 75, 100].map((size) => (
								<option key={size}>{size}</option>
							))}
						</select>
						<button type="button" className="btn btn-sm btn-icon" disabled={!page} onClick={() => goTo(0)}>
							<IconChevronsLeft size={16} />
						</button>
						<button
							type="button"
							className="btn btn-sm btn-icon"
							disabled={!page}
							onClick={() => goTo(page - 1)}
						>
							<IconChevronLeft size={16} />
						</button>
						<form
							className="d-flex align-items-center gap-2"
							onSubmit={(e) => {
								e.preventDefault();
								goTo(e.currentTarget.page.valueAsNumber - 1);
							}}
						>
							<input
								key={page}
								name="page"
								type="number"
								className="form-control form-control-sm text-center"
								style={{ width: "5rem" }}
								min={1}
								max={pages}
								required
								defaultValue={page + 1}
							/>
							/ {pages}
						</form>
						<button
							type="button"
							className="btn btn-sm btn-icon"
							disabled={page >= pages - 1}
							onClick={() => goTo(page + 1)}
						>
							<IconChevronRight size={16} />
						</button>
						<button
							type="button"
							className="btn btn-sm btn-icon"
							disabled={page >= pages - 1}
							onClick={() => goTo(pages - 1)}
						>
							<IconChevronsRight size={16} />
						</button>
					</div>
				) : null}
			</div>
		</div>
	);
}
