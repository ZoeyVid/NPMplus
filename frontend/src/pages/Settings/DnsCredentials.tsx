import { IconPencil, IconTrash } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useDnsCredentials, useDnsProviders } from "src/hooks";
import { T } from "src/locale";
import { deleteDnsCredential } from "src/api/backend";
import { Button, LoadingPage } from "src/components";
import { showObjectSuccess } from "src/notifications";
import { showDnsCredentialModal } from "src/modals";

export default function DnsCredentials() {
	const queryClient = useQueryClient();

	const { data: dnsProviders, isLoading: providersLoading } = useDnsProviders();
	const { data: savedCredentials, isLoading: credentialsLoading } = useDnsCredentials();

	if (providersLoading || credentialsLoading) {
		return <LoadingPage />;
	}

	const handleDelete = async (id: number) => {
		await deleteDnsCredential(id);
		queryClient.invalidateQueries({ queryKey: ["dns-credentials"] });
		showObjectSuccess("dns-credentials", "deleted");
	};

	return (
		<div className="card-body">
			<h3 className="card-title">
				<T id="settings.dns-credentials.title" />
			</h3>
			<p className="text-muted">
				<T id="settings.dns-credentials.description" />
			</p>

			<div className="mb-3">
				<Button actionType="primary" onClick={() => showDnsCredentialModal(-1)}>
					<T id="object.add" tData={{ object: "dns-credentials" }} />
				</Button>
			</div>

			<h4>
				<T id="settings.dns-credentials.saved" />
			</h4>

			{savedCredentials && savedCredentials.length > 0 ? (
				<div className="table-responsive">
					<table className="table table-vcenter">
						<thead>
							<tr>
								<th>
									<T id="settings.dns-credentials.name" />
								</th>
								<th>
									<T id="settings.dns-credentials.provider" />
								</th>
								<th>
									<T id="settings.dns-credentials.columns.actions" />
								</th>
							</tr>
						</thead>
						<tbody>
							{savedCredentials.map((cred) => {
								const provider = dnsProviders?.find((p) => p.id === cred.providerId);

								return (
									<tr key={cred.id}>
										<td>{cred.name}</td>
										<td>{provider?.name || cred.providerId}</td>
										<td>
											<Button
												variant="action"
												size="sm"
												onClick={() => showDnsCredentialModal(cred.id)}
											>
												<IconPencil size={16} />
											</Button>
											<Button variant="action" size="sm" onClick={() => handleDelete(cred.id)}>
												<IconTrash size={16} />
											</Button>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			) : (
				<p className="text-muted">
					<T id="settings.dns-credentials.none" />
				</p>
			)}
		</div>
	);
}
