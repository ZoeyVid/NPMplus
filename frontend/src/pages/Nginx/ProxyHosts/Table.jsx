import { IconCopy, IconDotsVertical, IconEdit, IconPower, IconTrash } from "@tabler/icons-react";
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
import {
	AccessListFormatter,
	CertificateFormatter,
	DomainsFormatter,
	EmptyData,
	ForwardHostFormatter,
	GravatarFormatter,
	HasPermission,
	StatusFormatter,
} from "src/components";
import { TableLayout } from "src/components/Table/TableLayout";
import { intl, T } from "src/locale";
import { MANAGE, PROXY_HOSTS } from "src/modules/Permissions";

const features = tableFeatures({
	rowSortingFeature,
	sortedRowModel: createSortedRowModel(),
	sortFns: {
		alphanumeric: sortFn_alphanumeric,
		datetime: sortFn_datetime,
		text: sortFn_text,
	},
});

export default function Table({
	data,
	isFetching,
	onEdit,
	onClone,
	onDelete,
	onDisableToggle,
	onNew,
	isFiltered,
	sorting,
	onSortingChange,
	showHeader,
	groupBy,
	renderGroupLabel,
}) {
	const columnHelper = createColumnHelper();
	const columns = useMemo(
		() => [
			columnHelper.accessor((row) => row.owner.name, {
				id: "owner",
				cell: (info) => {
					const value = info.row.original.owner;
					return <GravatarFormatter url={value ? value.avatar : ""} name={value ? value.name : ""} />;
				},
				meta: {
					className: "w-1",
				},
			}),
			columnHelper.accessor((row) => row.domainNames.join(", "), {
				id: "domainNames",
				header: intl.formatMessage({ id: "column.source" }),
				cell: (info) => {
					const value = info.row.original;
					return <DomainsFormatter domains={value.domainNames} createdOn={value.createdOn} />;
				},
			}),
			columnHelper.accessor(
				(row) => {
					const names = [];
					for (const server of row.npmplusUpstreamServers ?? []) {
						names.push(
							`${row.forwardScheme}://${server.host}${server.port ? `:${server.port}` : ""}`,
						);
					}
					return names.join(", ");
				},
				{
					id: "forwardHost",
					header: intl.formatMessage({ id: "column.destination" }),
					cell: (info) => (
						<ForwardHostFormatter
							proxyHostId={info.row.original.id}
							upstreamServers={info.row.original.npmplusUpstreamServers}
							scheme={info.row.original.forwardScheme}
							loadBalanceMethod={info.row.original.npmplusLoadBalanceMethod}
						/>
					),
				},
			),
			columnHelper.accessor((row) => (row.certificate ? row.certificate.provider : "http-only"), {
				id: "certificate",
				header: intl.formatMessage({ id: "column.ssl" }),
				cell: (info) => <CertificateFormatter certificate={info.row.original.certificate} />,
			}),
			columnHelper.accessor(
				(row) => {
					const accessLists = row.accessLists || [];
					const triggerLabel = intl.formatMessage({
						id: row.npmplusAccessListType === "custom" ? "access-list.custom" : "access-list.public",
					});
					if (accessLists.length === 1) {
						return accessLists[0].name;
					}
					return triggerLabel;
				},
				{
					id: "accessList",
					header: intl.formatMessage({ id: "column.access" }),
					cell: (info) => (
						<AccessListFormatter
							proxyHostId={info.row.original.id}
							locations={info.row.original.locations}
							access={info.row.original.accessLists}
							type={info.row.original.npmplusAccessListType}
						/>
					),
				},
			),
			columnHelper.accessor(
				(row) => {
					if (!row.enabled) return "3disabled";
					if (row.meta.nginxOnline) return "2online";
					return "1offline";
				},
				{
					id: "enabled",
					header: intl.formatMessage({ id: "column.status" }),
					cell: (info) => {
						const value = info.row.original;
						return (
							<StatusFormatter
								enabled={value.enabled}
								nginxOnline={value.meta.nginxOnline}
								nginxErr={value.meta.nginxErr}
							/>
						);
					},
				},
			),
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
					<span className="dropdown">
						<button
							type="button"
							className="btn dropdown-toggle btn-action btn-sm px-1"
							data-bs-boundary="viewport"
							data-bs-toggle="dropdown"
						>
							<IconDotsVertical />
						</button>
						<div className="dropdown-menu dropdown-menu-end">
							<span className="dropdown-header">
								<T
									id="object.actions-title"
									tData={{ object: "proxy-host" }}
									data={{ id: info.row.original.id }}
								/>
							</span>
							<button
								type="button"
								className="dropdown-item"
								onClick={() => {
									onEdit?.(info.row.original.id);
								}}
							>
								<IconEdit size={16} />
								<T id="action.edit" />
							</button>
							<button
								type="button"
								className="dropdown-item"
								onClick={() => {
									onClone?.(info.row.original.id);
								}}
							>
								<IconCopy size={16} />
								<T id="action.clone" />
							</button>
							<HasPermission section={PROXY_HOSTS} permission={MANAGE} hideError>
								<button
									type="button"
									className="dropdown-item"
									onClick={() => {
										onDisableToggle?.(info.row.original.id, !info.row.original.enabled);
									}}
								>
									<IconPower size={16} />
									<T id={info.row.original.enabled ? "action.disable" : "action.enable"} />
								</button>
								<div className="dropdown-divider" />
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
							</HasPermission>
						</div>
					</span>
				),
				meta: {
					className: "text-end w-1",
				},
			}),
		],
		[columnHelper, onEdit, onClone, onDisableToggle, onDelete],
	);

	const tableInstance = useTable({
		features,
		columns: columnHelper.columns(columns),
		data,
		meta: {
			isFetching,
		},
		enableSortingRemoval: false,
		state: sorting ? { sorting } : undefined,
		onSortingChange,
	});

	return (
		<TableLayout
			tableInstance={tableInstance}
			showHeader={showHeader}
			groupBy={groupBy}
			renderGroupLabel={renderGroupLabel}
			emptyState={
				<EmptyData
					object="proxy-host"
					objects="proxy-hosts"
					tableInstance={tableInstance}
					onNew={onNew}
					isFiltered={isFiltered}
					color="lime"
					permissionSection={PROXY_HOSTS}
				/>
			}
		/>
	);
}
