import type { Table as ReactTable, RowData, TableFeatures } from "@tanstack/react-table";

interface Props<TFeatures extends TableFeatures, TFields extends RowData> {
	tableInstance: ReactTable<TFeatures, TFields>;
}
function EmptyRow<TFeatures extends TableFeatures, TFields extends RowData>({
	tableInstance,
}: Props<TFeatures, TFields>) {
	return (
		<tr>
			<td colSpan={tableInstance.getAllFlatColumns().length}>
				<p className="text-center">There are no items</p>
			</td>
		</tr>
	);
}

export { EmptyRow };
