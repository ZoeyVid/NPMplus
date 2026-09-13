import { T } from "src/locale";

export function RolesFormatter({ roles }) {
	const r = roles || [];
	if (r.length === 0) {
		r[0] = "standard-user";
	}
	return (
		<>
			{r.map((role) => (
				<span key={role} className="badge bg-yellow-lt me-1">
					<T id={`role.${role}`} />
				</span>
			))}
		</>
	);
}
