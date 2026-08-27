import { IconSearch } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import Alert from "react-bootstrap/Alert";
import { adminDisableMfa, deleteUser, revokeSessions, toggleUser, type User } from "src/api/backend";
import { Button, LoadingPage } from "src/components";
import { useUser, useUsers } from "src/hooks";
import { T } from "src/locale";
import { showDeleteConfirmModal, showPermissionsModal, showSetPasswordModal, showUserModal } from "src/modals";
import { showObjectSuccess } from "src/notifications";
import Table from "./Table";

export default function TableWrapper() {
	const queryClient = useQueryClient();
	const [search, setSearch] = useState("");
	const { isFetching, isLoading, isError, error, data } = useUsers(["permissions"]);

	useEffect(() => {
		// this can happen if someone deletes the last item while searching
		if (search !== "" && !data) {
			setSearch("");
		}
	});
	const { data: currentUser } = useUser("me");

	if (isLoading) {
		return <LoadingPage />;
	}

	if (isError) {
		return <Alert variant="danger">{error?.message || "Unknown error"}</Alert>;
	}

	const handleDelete = async (id: number) => {
		await deleteUser(id);
		showObjectSuccess("user", "deleted");
	};

	const handleDisableToggle = async (id: number, enabled: boolean) => {
		await toggleUser(id, enabled);
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: ["users"] }),
			queryClient.invalidateQueries({ queryKey: ["user", id] }),
		]);
		showObjectSuccess("user", enabled ? "enabled" : "disabled");
	};

	const handleResetMfa = async (id: number) => {
		await adminDisableMfa(id);
		showObjectSuccess("user", "updated");
	};

	const handleRevokeSessions = async (id: number) => {
		await revokeSessions(id);
		showObjectSuccess("user", "updated");
	};

	let filtered: User[] | null = null;
	if (search && data) {
		filtered = data?.filter(
			(item) =>
				item.name.toLowerCase().includes(search) ||
				item.nickname.toLowerCase().includes(search) ||
				item.email.toLowerCase().includes(search),
		);
	}

	return (
		<div className="card mt-4">
			<div className="card-status-top bg-orange" />
			<div className="card-table">
				<div className="card-header">
					<div className="row w-full">
						<div className="col">
							<h2 className="mt-1 mb-0">
								<T id="users" />
							</h2>
						</div>
						{data?.length ? (
							<div className="col-md-auto col-sm-12">
								<div className="ms-auto d-flex flex-wrap btn-list">
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

									<Button size="sm" className="btn-orange" onClick={() => showUserModal("new")}>
										<T id="object.add" tData={{ object: "user" }} />
									</Button>
								</div>
							</div>
						) : null}
					</div>
				</div>
				<Table
					data={filtered ?? data ?? []}
					isFiltered={Boolean(search)}
					isFetching={isFetching}
					currentUserId={currentUser?.id}
					onEditUser={(id: number) => showUserModal(id)}
					onEditPermissions={(id: number) => showPermissionsModal(id)}
					onSetPassword={(id: number) => showSetPasswordModal(id)}
					onResetMfa={(id: number) => {
						const user = data?.find((item) => item.id === id);
						showDeleteConfirmModal({
							tTitle: "user.reset-mfa",
							children: <T id="user.reset-mfa.content" />,
							subject: user?.name,
							details: user?.email,
							onConfirm: () => handleResetMfa(id),
							invalidations: [["users"], ["user", id]],
						});
					}}
					onRevokeSessions={(id: number) => {
						const user = data?.find((item) => item.id === id);
						showDeleteConfirmModal({
							tTitle: "user.revoke-sessions",
							children: <T id="user.revoke-sessions.content" />,
							subject: user?.name,
							details: user?.email,
							onConfirm: () => handleRevokeSessions(id),
							invalidations: [["users"], ["user", id]],
						});
					}}
					onDeleteUser={(id: number) => {
						const user = data?.find((item) => item.id === id);
						showDeleteConfirmModal({
							title: <T id="object.delete" tData={{ object: "user" }} />,
							onConfirm: () => handleDelete(id),
							invalidations: [["users"], ["user", id]],
							children: <T id="object.delete.content" tData={{ object: "user" }} />,
							subject: user?.name,
							details: user?.email,
						});
					}}
					onDisableToggle={handleDisableToggle}
					onNewUser={() => showUserModal("new")}
				/>
			</div>
		</div>
	);
}
