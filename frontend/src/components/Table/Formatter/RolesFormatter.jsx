import { T } from "src/locale";

export function RolesFormatter({ isAdmin }) {
	return (
		<span className="badge bg-yellow-lt me-1">
			<T id={isAdmin ? "role.admin" : "role.standard-user"} />
		</span>
	);
}
