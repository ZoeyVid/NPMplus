import { useNavigate } from "react-router";

export function NavLink({ children, to, href, isDropdownItem, onClick }) {
	const navigate = useNavigate();

	if (href) {
		return (
			<a
				className={isDropdownItem ? "dropdown-item" : "nav-link"}
				href={href}
				target="_blank"
				rel="noopener noreferrer"
				onClick={onClick}
			>
				{children}
			</a>
		);
	}

	return (
		<a
			className={isDropdownItem ? "dropdown-item" : "nav-link"}
			href={to}
			onClick={(e) => {
				e.preventDefault();
				if (onClick) {
					onClick();
				}
				if (to) {
					void navigate(to);
				}
			}}
		>
			{children}
		</a>
	);
}
