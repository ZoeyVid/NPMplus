import { flexRender } from "@tanstack/react-table";
import { AnimatePresence, motion } from "framer-motion";
import type { TableLayoutProps } from "src/components";
import { EmptyRow } from "./EmptyRow";

function TableBody<T>(props: TableLayoutProps<T>) {
	const { tableInstance, extraStyles, emptyState } = props;
	const rows = tableInstance.getRowModel().rows;

	if (rows.length === 0) {
		return (
			<tbody className="table-tbody">
				{emptyState ? emptyState : <EmptyRow tableInstance={tableInstance} />}
			</tbody>
		);
	}

	return (
		<tbody className="table-tbody">
			<AnimatePresence mode="popLayout" initial={false}>
				{rows.map((row) => {
					return (
						<motion.tr
							key={row.id}
							{...extraStyles?.row(row.original)}
							initial={{ opacity: 0, x: -20 }}
							animate={{ opacity: 1, x: 0 }}
							exit={{ opacity: 0, x: 20 }}
							transition={{ duration: 0.2 }}
							layout
						>
							{row.getVisibleCells().map((cell) => {
								const { className } = (cell.column.columnDef.meta as any) ?? {};
								return (
									<td key={cell.id} className={className}>
										{flexRender(cell.column.columnDef.cell, cell.getContext())}
									</td>
								);
							})}
						</motion.tr>
					);
				})}
			</AnimatePresence>
		</tbody>
	);
}

export { TableBody };
