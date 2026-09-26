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
	sortFns: {
		alphanumeric: sortFn_alphanumeric,
		datetime: sortFn_datetime,
		text: sortFn_text,
	},
});

const isInUse = (row) =>
	[
		row.proxyHosts,
		row.redirectionHosts,
		row.deadHosts,
		row.streams,
		row.mtlsProxyHosts,
		row.mtlsRedirectionHosts,
		row.mtlsDeadHosts,
		row.mtlsStreams,
	].some((hosts) => hosts?.length > 0);

export default function Table({ data, isFetching, onDelete, onRenew, onDownload, onTest, onEdit, isFiltered }) {
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
				header: intl.formatMessage({ id: "column.name" }),
				cell: (info) => {
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
				(row) => (row.npmplusDnsProvider ? `${row.provider} - ${row.npmplusDnsProvider}` : row.provider),
				{
					id: "provider",
					header: intl.formatMessage({ id: "column.provider" }),
					cell: (info) => {
						const r = info.row.original;
						if (r.provider === "letsencrypt") {
							if (r.npmplusDnsChallenge && r.npmplusDnsProvider) {
								return (
									<>
										<T id="lets-encrypt" /> &ndash; {r.npmplusDnsProvider}
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
			columnHelper.accessor((row) => row.expiresOn, {
				id: "expiresOn",
				header: intl.formatMessage({ id: "column.expires" }),
				cell: (info) => <DateFormatter value={info.getValue()} highlightPast />,
			}),
			columnHelper.accessor(isInUse, {
				id: "inUse",
				header: intl.formatMessage({ id: "column.status" }),
				cell: (info) => {
					const r = info.row.original;
					return (
						<CertificateInUseFormatter
							proxyHosts={[...(r.proxyHosts || []), ...(r.mtlsProxyHosts || [])]}
							redirectionHosts={[...(r.redirectionHosts || []), ...(r.mtlsRedirectionHosts || [])]}
							deadHosts={[...(r.deadHosts || []), ...(r.mtlsDeadHosts || [])]}
							streams={[...(r.streams || []), ...(r.mtlsStreams || [])]}
						/>
					);
				},
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
				cell: (info) => {
					const row = info.row.original;
					const inUse = isInUse(row);

					return (
						<span className="dropdown">
							<button
								type="button"
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
										tData={{ object: "certificate" }}
										data={{ id: row.id }}
									/>
								</span>

								{row.provider === "letsencrypt" && !row.npmplusDnsProvider && (
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
		[columnHelper, onDelete, onRenew, onDownload, onTest, onEdit],
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
			<button
				type="button"
				className="btn dropdown-toggle btn-pink my-3"
				data-bs-toggle="dropdown"
				data-bs-popper-config='{"strategy":"fixed"}'
			>
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
