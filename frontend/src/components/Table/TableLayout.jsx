import { TableBody } from "./TableBody";
import { TableHeader } from "./TableHeader";

function TableLayout(props) {
	const hasRows = props.tableInstance.getRowModel().rows.length > 0;
	const showHeader = props.showHeader ?? true;
	return (
		<div className="table-responsive">
			<table className="table table-vcenter table-selectable mb-0">
				{hasRows && showHeader ? <TableHeader tableInstance={props.tableInstance} /> : null}
				<TableBody {...props} />
			</table>
		</div>
	);
}

export { TableLayout };
