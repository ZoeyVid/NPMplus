import { useEffect, useRef } from "react";
import { Pagination } from "./Pagination";
import { TableBody } from "./TableBody";
import { TableHeader } from "./TableHeader";

function TableLayout(props) {
	const hasRows = props.tableInstance.getRowModel().rows.length > 0;
	const showHeader = props.showHeader ?? true;
	const { pagination } = props.tableInstance.state;
	const rowCount = props.tableInstance.getRowCount?.();
	const lastFilter = useRef(props.isFiltered);
	const paginationProps = pagination
		? {
				total: rowCount,
				page: pagination.pageIndex,
				pageSize: pagination.pageSize,
				onChange: (pageIndex, pageSize) => props.tableInstance.setPagination({ pageIndex, pageSize }),
			}
		: null;

	useEffect(() => {
		if (props.isFiltered !== lastFilter.current) {
			lastFilter.current = props.isFiltered;
			props.tableInstance.firstPage();
		} else if (!hasRows && pagination?.pageIndex) {
			props.tableInstance.lastPage();
		}
	});

	return (
		<>
			{paginationProps ? <Pagination top {...paginationProps} /> : null}
			<div className="table-responsive">
				<table className="table table-vcenter table-selectable mb-0">
					{hasRows && showHeader ? <TableHeader tableInstance={props.tableInstance} /> : null}
					<TableBody {...props} />
				</table>
			</div>
			{paginationProps ? <Pagination {...paginationProps} /> : null}
		</>
	);
}

export { TableLayout };
