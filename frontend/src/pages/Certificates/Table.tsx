import { IconDotsVertical, IconDownload, IconEdit, IconFlask, IconRefresh, IconTrash } from "@tabler/icons-react";
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
import type { Certificate } from "src/api/backend";
import {
	CertificateInUseFormatter,
	DateFormatter,
	DomainsFormatter,
	EmptyData,
	GravatarFormatter,
	HasPermission,
} from "src/components";
import { TableLayout } from "src/components/Table/TableLayout";
import { intl, T } from "src/locale";
import { showCustomCertificateModal, showDNSCertificateModal, showHTTPCertificateModal } from "src/modals";
import { CERTIFICATES, MANAGE } from "src/modules/Permissions";

const features = tableFeatures({
	rowSortingFeature,
	sortedRowModel: createSortedRowModel(),
	sortFns: { alphanumeric: sortFn_alphanumeric, datetime: sortFn_datetime, text: sortFn_text },
});

interface Props {
	data: Certificate[];
	allData: Certificate[];
	isFiltered?: boolean;
	isFetching?: boolean;
	onDelete?: (id: number) => void;
	onRenew?: (id: number) => void;
	onDownload?: (id: number) => void;
	onTest?: (domains: string[]) => void;
	onEdit?: (cert: Certificate) => void;
}

export default function Table({
	data,
	allData,
	isFetching,
	onDelete,
	onRenew,
	onDownload,
	onTest,
	onEdit,
	isFiltered,
}: Props) {
	const mtlsInUseIds = new Set<number>();

	for (const certificate of allData) {
		const usageRows = [
			...(certificate.proxyHosts || []),
			...(certificate.redirectionHosts || []),
			...(certificate.deadHosts || []),
			...(certificate.streams || []),
		];

		for (const usageRow of usageRows) {
			if (Number(usageRow.meta?.npmplusMtlsCertificateId) > 0) {
				mtlsInUseIds.add(Number(usageRow.meta?.npmplusMtlsCertificateId));
			}
		}
	}

	const columnHelper = createColumnHelper<typeof features, Certificate>();
	const columns = useMemo(
		() => [
			columnHelper.accessor((row: any) => row.owner.name, {
				id: "owner",
				cell: (info: any) => {
					const value = info.row.original.owner;
					return <GravatarFormatter url={value ? value.avatar : ""} name={value ? value.name : ""} />;
				},
				meta: {
					className: "w-1",
				},
			}),
			columnHelper.accessor((row: any) => row.domainNames.join(", "), {
				id: "domainNames",
				header: intl.formatMessage({ id: "column.name" }),
				cell: (info: any) => {
					const value = info.row.original;
					return (
						<DomainsFormatter
							domains={value.domainNames}
							createdOn={value.createdOn}
							niceName={value.niceName}
							provider={value.provider || ""}
						/>
					);
				},
			}),
			columnHelper.accessor(
				(row: any) => (row.meta?.dnsProvider ? `${row.provider} - ${row.meta.dnsProvider}` : row.provider),
				{
					id: "provider",
					header: intl.formatMessage({ id: "column.provider" }),
					cell: (info: any) => {
						const r = info.row.original;
						if (r.provider === "letsencrypt") {
							if (r.meta?.dnsChallenge && r.meta?.dnsProvider) {
								return (
									<>
										<T id="lets-encrypt" /> &ndash; {r.meta?.dnsProvider}
									</>
								);
							}
							return <T id="lets-encrypt" />;
						}
						if (r.provider === "other") {
							return <T id="certificates.custom" />;
						}
						return <T id={r.provider} />;
					},
				},
			),
			columnHelper.accessor((row: any) => row.expiresOn, {
				id: "expiresOn",
				header: intl.formatMessage({ id: "column.expires" }),
				cell: (info: any) => <DateFormatter value={info.getValue()} highlightPast />,
			}),
			columnHelper.accessor(
				(row: Certificate) =>
					(row.proxyHosts?.length || 0) +
						(row.redirectionHosts?.length || 0) +
						(row.deadHosts?.length || 0) +
						(row.streams?.length || 0) >
						0 || mtlsInUseIds.has(row.id),
				{
					id: "inUse",
					header: intl.formatMessage({ id: "column.status" }),
					cell: (info: any) => {
						const r = info.row.original;
						return (
							<CertificateInUseFormatter
								proxyHosts={
									r.provider === "mtls"
										? allData.flatMap((certificate) =>
												(certificate.proxyHosts || []).filter(
													(host) => Number(host.meta?.npmplusMtlsCertificateId) === r.id,
												),
											)
										: r.proxyHosts
								}
								redirectionHosts={
									r.provider === "mtls"
										? allData.flatMap((certificate) =>
												(certificate.redirectionHosts || []).filter(
													(host) => Number(host.meta?.npmplusMtlsCertificateId) === r.id,
												),
											)
										: r.redirectionHosts
								}
								deadHosts={
									r.provider === "mtls"
										? allData.flatMap((certificate) =>
												(certificate.deadHosts || []).filter(
													(host) => Number(host.meta?.npmplusMtlsCertificateId) === r.id,
												),
											)
										: r.deadHosts
								}
								streams={
									r.provider === "mtls"
										? allData.flatMap((certificate) =>
												(certificate.streams || []).filter(
													(stream) => Number(stream.meta?.npmplusMtlsCertificateId) === r.id,
												),
											)
										: r.streams
								}
								mtlsInUse={mtlsInUseIds.has(r.id)}
							/>
						);
					},
				},
			),
			columnHelper.accessor((row: any) => row.id, {
				id: "id",
				header: "ID",
				cell: (info: any) => info.getValue(),
				meta: {
					className: "text-end w-1",
				},
			}),
			columnHelper.display({
				id: "actions",
				cell: (info: any) => {
					const row = info.row.original;
					const inUse =
						(row.proxyHosts?.length || 0) +
							(row.redirectionHosts?.length || 0) +
							(row.deadHosts?.length || 0) +
							(row.streams?.length || 0) >
							0 || mtlsInUseIds.has(row.id);

					return (
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
										tData={{ object: "certificate" }}
										data={{ id: row.id }}
									/>
								</span>

								{row.provider === "letsencrypt" && !row.meta?.dnsProvider && (
									<button
										type="button"
										className="dropdown-item"
										onClick={() => {
											onTest?.(row.domainNames);
										}}
									>
										<IconFlask size={16} />
										<T id="test" />
									</button>
								)}

								<HasPermission section={CERTIFICATES} permission={MANAGE} hideError>
									{(row.provider === "other" || row.provider === "mtls") && (
										<button
											type="button"
											className="dropdown-item"
											onClick={() => {
												onEdit?.(row);
											}}
										>
											<IconEdit size={16} />
											<T id="action.edit" />
										</button>
									)}

									{row.provider === "letsencrypt" && (
										<>
											<button
												type="button"
												className="dropdown-item"
												onClick={() => {
													onRenew?.(row.id);
												}}
											>
												<IconRefresh size={16} />
												<T id="action.renew" />
											</button>

											<button
												type="button"
												className="dropdown-item"
												onClick={() => {
													onDownload?.(row.id);
												}}
											>
												<IconDownload size={16} />
												<T id="action.download" />
											</button>
										</>
									)}

									{!inUse && (
										<>
											<div className="dropdown-divider" />
											<button
												type="button"
												className="dropdown-item"
												onClick={() => {
													onDelete?.(row.id);
												}}
											>
												<IconTrash size={16} />
												<T id="action.delete" />
											</button>
										</>
									)}
								</HasPermission>
							</div>
						</span>
					);
				},
				meta: {
					className: "text-end w-1",
				},
			}),
		],
		[columnHelper, mtlsInUseIds, onDelete, onRenew, onDownload, onTest, onEdit, allData],
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

	const customAddBtn = (
		<div className="dropdown">
			<button type="button" className="btn dropdown-toggle btn-pink my-3" data-bs-toggle="dropdown">
				<T id="object.add" tData={{ object: "certificate" }} />
			</button>
			<div className="dropdown-menu">
				<button
					type="button"
					className="dropdown-item"
					onClick={() => {
						showHTTPCertificateModal();
					}}
				>
					<T id="lets-encrypt-via-http" />
				</button>
				<button
					type="button"
					className="dropdown-item"
					onClick={() => {
						showDNSCertificateModal();
					}}
				>
					<T id="lets-encrypt-via-dns" />
				</button>
				<div className="dropdown-divider" />
				<button
					type="button"
					className="dropdown-item"
					onClick={() => {
						showCustomCertificateModal();
					}}
				>
					<T id="certificates.custom" />
				</button>
				<div className="dropdown-divider" />
				<button
					type="button"
					className="dropdown-item"
					onClick={() => {
						showCustomCertificateModal(undefined, "mtls");
					}}
				>
					mTLS
				</button>
			</div>
		</div>
	);

	return (
		<TableLayout
			tableInstance={tableInstance}
			emptyState={
				<EmptyData
					object="certificate"
					objects="certificates"
					tableInstance={tableInstance}
					isFiltered={isFiltered}
					color="pink"
					customAddBtn={customAddBtn}
					permissionSection={CERTIFICATES}
				/>
			}
		/>
	);
}
