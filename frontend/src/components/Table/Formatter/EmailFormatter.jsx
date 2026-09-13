export function EmailFormatter({ email }) {
	return (
		<a href={`mailto:${email}`} className="badge bg-yellow-lt">
			{email}
		</a>
	);
}
