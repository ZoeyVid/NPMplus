import { IconDotsVertical, IconTrash } from "@tabler/icons-react";
import {
	createColumnHelper,
	createPaginatedRowModel,
	createSortedRowModel,
	rowPaginationFeature,
	rowSortingFeature,
	sortFn_alphanumeric,
	sortFn_datetime,
	sortFn_text,
	tableFeatures,
	useTable,
} from "@tanstack/react-table";
import { useMemo } from "react";
import { EditButton, EmptyData, GravatarFormatter, HasPermission, ValueWithDateFormatter } from "src/components";
import { TableLayout } from "src/components/Table/TableLayout";
import { intl, T } from "src/locale";
import { ACCESS_LISTS, MANAGE } from "src/modules/Permissions";

const features = tableFeatures({
	rowSortingFeature,
	sortedRowModel: createSortedRowModel(),
	rowPaginationFeature,
	paginatedRowModel: createPaginatedRowModel(),
	sortFns: {
		alphanumeric: sortFn_alphanumeric,
		datetime: sortFn_datetime,
		text: sortFn_text,
	},
});

export default function Table({ data, isFetching, isFiltered, onEdit, onDelete, onNew }) {
	const columnHelper = createColumnHelper();
	const columns = useMemo(
		() => [
			columnHelper.accessor((row) => row.owner?.name, {
				id: "owner",
				cell: (info) => {
					const value = info.row.original.owner;
					return (
						<GravatarFormatter
							url={value ? value.avatar : ""}
							name={value ? value.name : intl.formatMessage({ id: "user.deleted" })}
						/>
					);
				},
				meta: {
					className: "w-1",
				},
			}),
			columnHelper.accessor((row) => row.name, {
				id: "name",
				header: intl.formatMessage({ id: "column.name" }),
				cell: (info) => (
					<ValueWithDateFormatter value={info.row.original.name} createdOn={info.row.original.createdOn} />
				),
			}),
			columnHelper.accessor((row) => row.items.length, {
				id: "items",
				header: intl.formatMessage({ id: "column.authorization" }),
				cell: (info) => <T id="access-list.auth-count" data={{ count: info.getValue() }} />,
			}),
			columnHelper.accessor(
				(row) => row.clients.filter(({ address }) => address.toLowerCase() !== "all").length,
				{
					id: "clients",
					header: intl.formatMessage({ id: "column.access" }),
					cell: (info) => <T id="access-list.access-count" data={{ count: info.getValue() }} />,
				},
			),
			columnHelper.accessor((row) => row.satisfyAny, {
				id: "satisfyAny",
				header: intl.formatMessage({ id: "column.satisfy" }),
				cell: (info) => <T id={info.getValue() ? "column.satisfy-any" : "column.satisfy-all"} />,
			}),
			columnHelper.accessor((row) => row.proxyHostCount, {
				id: "proxyHostCount",
				header: intl.formatMessage({ id: "proxy-hosts" }),
				cell: (info) => <T id="proxy-hosts.count" data={{ count: info.getValue() }} />,
			}),
			columnHelper.accessor((row) => row.id, {
				id: "id",
				header: "ID",
				cell: (info) => info.getValue(),
				meta: {
					className: "text-end w-1",
				},
			}),
			columnHelper.display({
				id: "actions",
				cell: (info) => (
					<div className="d-flex justify-content-end gap-1">
						<EditButton section={ACCESS_LISTS} onClick={() => onEdit?.(info.row.original.id)} />
						<HasPermission section={ACCESS_LISTS} permission={MANAGE} hideError>
							<span className="dropdown">
								<button
									type="button"
									title={intl.formatMessage(
										{ id: "object.actions" },
										{ object: intl.formatMessage({ id: "access-list" }), id: info.row.original.id },
									)}
									className="btn dropdown-toggle btn-action btn-sm px-1"
									data-bs-boundary="viewport"
									data-bs-toggle="dropdown"
									data-bs-popper-config='{"strategy":"fixed"}'
								>
									<IconDotsVertical />
								</button>
								<div className="dropdown-menu dropdown-menu-end">
									<span className="dropdown-header">
										<T
											id="object.actions-title"
											tData={{ object: "access-list" }}
											data={{ id: info.row.original.id }}
										/>
									</span>
									<button
										type="button"
										className="dropdown-item"
										onClick={() => {
											onDelete?.(info.row.original.id);
										}}
									>
										<IconTrash size={16} />
										<T id="action.delete" />
									</button>
								</div>
							</span>
						</HasPermission>
					</div>
				),
				meta: {
					className: "text-end w-1",
				},
			}),
		],
		[columnHelper, onEdit, onDelete],
	);

	const tableInstance = useTable({
		features,
		columns,
		data,
		getRowId: (row) => `${row.id}`,
		meta: {
			isFetching,
		},
		enableSortingRemoval: false,
		autoResetPageIndex: false,
		initialState: { pagination: { pageSize: 25 } },
	});

	return (
		<TableLayout
			tableInstance={tableInstance}
			isFiltered={isFiltered}
			emptyState={
				<EmptyData
					object="access-list"
					objects="access-lists"
					tableInstance={tableInstance}
					onNew={onNew}
					isFiltered={isFiltered}
					color="cyan"
					permissionSection={ACCESS_LISTS}
				/>
			}
		/>
	);
}
