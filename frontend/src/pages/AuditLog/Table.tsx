import {
	createColumnHelper,
	createSortedRowModel,
	rowSortingFeature,
	sortFn_alphanumeric,
	sortFn_datetime,
	sortFn_text,
	tableFeatures,
	useTable,
} from "@tanstack/react-table";
import { useMemo } from "react";
import type { AuditLog } from "src/api/backend";
import { EventFormatter, GravatarFormatter } from "src/components";
import { TableLayout } from "src/components/Table/TableLayout";
import { intl, T } from "src/locale";

const features = tableFeatures({
	rowSortingFeature,
	sortedRowModel: createSortedRowModel(),
	sortFns: { alphanumeric: sortFn_alphanumeric, datetime: sortFn_datetime, text: sortFn_text },
});

interface Props {
	data: AuditLog[];
	isFetching?: boolean;
	onSelectItem?: (id: number) => void;
}
export default function Table({ data, isFetching, onSelectItem }: Props) {
	const columnHelper = createColumnHelper<typeof features, AuditLog>();
	const columns = useMemo(
		() => [
			columnHelper.accessor((row: AuditLog) => row.user?.name, {
				id: "avatar",
				cell: (info: any) => {
					const value = info.row.original.user;
					return <GravatarFormatter url={value ? value.avatar : ""} name={value ? value.name : ""} />;
				},
				meta: {
					className: "w-1",
				},
			}),
			columnHelper.accessor((row: AuditLog) => row.createdOn, {
				id: "log",
				header: intl.formatMessage({ id: "column.event" }),
				cell: (info: any) => <EventFormatter row={info.row.original} />,
			}),
			columnHelper.display({
				id: "details",
				cell: (info: any) => (
					<button
						type="button"
						className="btn btn-action btn-sm px-1"
						onClick={(e) => {
							e.preventDefault();
							onSelectItem?.(info.row.original.id);
						}}
					>
						<T id="action.view-details" />
					</button>
				),
				meta: {
					className: "text-end w-1",
				},
			}),
		],
		[columnHelper, onSelectItem],
	);

	const tableInstance = useTable({
		features,
		columns: columnHelper.columns(columns),
		data,
		meta: {
			isFetching,
		},
		enableSortingRemoval: false,
	});

	return <TableLayout tableInstance={tableInstance} />;
}
