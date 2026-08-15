import { IconHelp, IconSearch } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import Alert from "react-bootstrap/Alert";
import { type Certificate, deleteCertificate, downloadCertificate } from "src/api/backend";
import { Button, certificateProviderTranslation, HasPermission, LoadingPage } from "src/components";
import { useLocaleState } from "src/context";
import { useCertificates } from "src/hooks";
import { formatDateTime, T } from "src/locale";
import {
	showCustomCertificateModal,
	showDeleteConfirmModal,
	showDNSCertificateModal,
	showHelpModal,
	showHTTPCertificateModal,
	showReachabilityModal,
	showRenewCertificateModal,
} from "src/modals";
import { CERTIFICATES, MANAGE } from "src/modules/Permissions";
import { showError, showObjectSuccess } from "src/notifications";
import Table from "./Table";

export default function TableWrapper() {
	const { locale } = useLocaleState();

	const [search, setSearch] = useState("");
	const { isFetching, isLoading, isError, error, data } = useCertificates([
		"owner",
		"dead_hosts",
		"proxy_hosts",
		"redirection_hosts",
		"streams",
	]);

	useEffect(() => {
		// this can happen if someone deletes the last item while searching
		if (search !== "" && !data) {
			setSearch("");
		}
	});

	if (isLoading) {
		return <LoadingPage />;
	}

	if (isError) {
		return <Alert variant="danger">{error?.message || "Unknown error"}</Alert>;
	}

	const handleDelete = async (id: number) => {
		await deleteCertificate(id);
		showObjectSuccess("certificate", "deleted");
	};

	const handleDownload = async (id: number) => {
		try {
			await downloadCertificate(id);
		} catch (err: any) {
			showError(err.message);
		}
	};

	let filtered: Certificate[] | null = null;
	if (search && data) {
		filtered = data?.filter(
			(item) =>
				item.domainNames.some((domain: string) => domain.toLowerCase().includes(search)) ||
				item.niceName.toLowerCase().includes(search),
		);
	}

	return (
		<div className="card mt-4">
			<div className="card-status-top bg-pink" />
			<div className="card-table">
				<div className="card-header">
					<div className="row w-full">
						<div className="col">
							<h2 className="mt-1 mb-0">
								<T id="certificates" />
							</h2>
						</div>
						<div className="col-md-auto col-sm-12">
							<div className="ms-auto d-flex flex-wrap btn-list">
								{data?.length ? (
									<div className="input-group input-group-flat w-auto">
										<span className="input-group-text input-group-text-sm">
											<IconSearch size={16} />
										</span>
										<input
											type="text"
											className="form-control form-control-sm"
											autoComplete="off"
											onChange={(e: any) => setSearch(e.target.value.toLowerCase().trim())}
										/>
									</div>
								) : null}
								<Button size="sm" onClick={() => showHelpModal("Certificates")}>
									<IconHelp size={20} />
								</Button>
								<HasPermission section={CERTIFICATES} permission={MANAGE} hideError>
									{data?.length ? (
										<div className="dropdown">
											<button
												type="button"
												className="btn btn-sm dropdown-toggle btn-pink mt-1"
												data-bs-toggle="dropdown"
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
									) : null}
								</HasPermission>
							</div>
						</div>
					</div>
				</div>
				<Table
					data={filtered ?? data ?? []}
					allData={data ?? []}
					isFiltered={Boolean(search)}
					isFetching={isFetching}
					onRenew={showRenewCertificateModal}
					onDownload={handleDownload}
					onEdit={(cert: Certificate) => showCustomCertificateModal(cert)}
					onTest={(domains: string[]) => showReachabilityModal(domains)}
					onDelete={(id: number) => {
						const certificate = data?.find((item) => item.id === id);
						const domainNames = certificate?.domainNames.join(", ");
						showDeleteConfirmModal({
							title: <T id="object.delete" tData={{ object: "certificate" }} />,
							onConfirm: () => handleDelete(id),
							invalidations: [["certificates"], ["certificate", id]],
							children: <T id="object.delete.content" tData={{ object: "certificate" }} />,
							subject: domainNames || certificate?.niceName,
							details: certificate ? (
								<>
									{domainNames && certificate.niceName !== domainNames ? (
										<div>{certificate.niceName}</div>
									) : null}
									<div>
										<T id={certificateProviderTranslation(certificate.provider)} />
										{certificate.meta?.dnsProvider ? ` – ${certificate.meta.dnsProvider}` : null}
									</div>
									{certificate.expiresOn ? (
										<div>
											<T
												id="expires.on"
												data={{ date: formatDateTime(certificate.expiresOn, locale) }}
											/>
										</div>
									) : null}
								</>
							) : null,
						});
					}}
				/>
			</div>
		</div>
	);
}
