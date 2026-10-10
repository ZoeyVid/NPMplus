import { T } from "src/locale";

export function RolesFormatter({ roles }) {
	if (roles.length === 0) {
		roles[0] = "standard-user";
	}
	return (
		<>
			{roles.map((role) => (
				<span key={role} className="badge bg-yellow-lt me-1">
					<T id={`role.${role}`} />
				</span>
			))}
		</>
	);
}
