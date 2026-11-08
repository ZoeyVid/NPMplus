import { useNavigate } from "react-router";
import { focusMenuToggle } from "src/modules/Focus";

export function NavLink({ children, to, href, isDropdownItem, active, onClick }) {
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
			className={`${isDropdownItem ? "dropdown-item" : "nav-link"}${active ? " active" : ""}`}
			href={to}
			onClick={(e) => {
				e.preventDefault();
				if (isDropdownItem) focusMenuToggle(e.currentTarget);
				if (onClick) {
					onClick();
				}
				void navigate(to);
			}}
		>
			{children}
		</a>
	);
}
