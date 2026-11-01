import { flexRender } from "@tanstack/react-table";
import { Fragment } from "react";
import { EmptyRow } from "./EmptyRow";

function TableBody(props) {
	const { tableInstance, extraStyles, emptyState, groupBy, renderGroupLabel } = props;
	const { rows } = tableInstance.getRowModel();

	if (rows.length === 0) {
		return (
			<tbody className="table-tbody">
				{emptyState ? emptyState : <EmptyRow tableInstance={tableInstance} />}
			</tbody>
		);
	}

	const renderRow = (row) => (
		<tr key={row.id} {...extraStyles?.row(row.original)}>
			{row.getAllCells().map((cell) => {
				const { className } = cell.column.columnDef.meta ?? {};
				return (
					<td key={cell.id} className={className}>
						{flexRender(cell.column.columnDef.cell, cell.getContext())}
					</td>
				);
			})}
		</tr>
	);

	if (!groupBy) {
		return <tbody className="table-tbody">{rows.map(renderRow)}</tbody>;
	}

	const groups = Map.groupBy(rows, (row) => groupBy(row.original));
	const orderedKeys = [...groups.keys()].sort((a, b) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)));
	const colSpan = tableInstance.getAllLeafColumns().length;

	return (
		<tbody className="table-tbody">
			{orderedKeys.map((key) => (
				<Fragment key={key}>
					<tr>
						<th
							scope="rowgroup"
							colSpan={colSpan}
							className="subheader fw-bold text-secondary py-2 border-bottom bg-surface-secondary"
						>
							{renderGroupLabel(key)}
						</th>
					</tr>
					{groups.get(key)?.map(renderRow)}
				</Fragment>
			))}
		</tbody>
	);
}

export { TableBody };
