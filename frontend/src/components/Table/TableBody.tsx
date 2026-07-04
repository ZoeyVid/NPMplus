import { flexRender } from "@tanstack/react-table";
import { Fragment } from "react";
import type { TableLayoutProps } from "src/components";
import { EmptyRow } from "./EmptyRow";

function TableBody<T>(props: TableLayoutProps<T>) {
	const { tableInstance, extraStyles, emptyState, groupBy, renderGroupLabel } = props;
	const rows = tableInstance.getRowModel().rows;

	if (rows.length === 0) {
		return (
			<tbody className="table-tbody">
				{emptyState ? emptyState : <EmptyRow tableInstance={tableInstance} />}
			</tbody>
		);
	}

	const renderRow = (row: any) => (
		<tr key={row.id} {...extraStyles?.row(row.original)}>
			{row.getVisibleCells().map((cell: any) => {
				const { className } = (cell.column.columnDef.meta as any) ?? {};
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

	const groups = new Map<string, typeof rows>();
	for (const row of rows) {
		const key = groupBy(row.original);
		const bucket = groups.get(key);
		if (bucket) bucket.push(row);
		else groups.set(key, [row]);
	}
	const orderedKeys = [...groups.keys()].sort((a, b) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)));
	const colSpan = tableInstance.getVisibleLeafColumns().length;

	return (
		<tbody className="table-tbody">
			{orderedKeys.map((key) => (
				<Fragment key={key || "no-group"}>
					<tr>
						<th
							scope="rowgroup"
							colSpan={colSpan}
							className="fw-bold text-secondary text-uppercase py-2 border-bottom"
							style={{
								backgroundColor: "var(--tblr-bg-surface-secondary)",
								fontSize: "0.75rem",
								letterSpacing: "0.05em",
							}}
						>
							{renderGroupLabel ? renderGroupLabel(key) : key}
						</th>
					</tr>
					{groups.get(key)?.map(renderRow)}
				</Fragment>
			))}
		</tbody>
	);
}

export { TableBody };
