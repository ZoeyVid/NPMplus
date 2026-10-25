import { IconSearch } from "@tabler/icons-react";
import { useState } from "react";
import Alert from "react-bootstrap/Alert";
import { LoadingPage, Pagination } from "src/components";
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

	const paginationProps = {
		total: data.total,
		page,
		pageSize,
		onChange: (index, size) => {
			setPage(index);
			setPageSize(size);
		},
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
				<Pagination top {...paginationProps} />
				<Table data={data.results} isFetching={isFetching} onSelectItem={showEventDetailsModal} />
				<Pagination {...paginationProps} />
			</div>
		</div>
	);
}
