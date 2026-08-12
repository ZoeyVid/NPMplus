import { useNavigate } from "react-router";

interface Props {
	children: React.ReactNode;
	to?: string;
	href?: string;
	isDropdownItem?: boolean;
	onClick?: () => void;
}
export function NavLink({ children, to, href, isDropdownItem, onClick }: Props) {
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
					navigate(to);
				}
			}}
		>
			{children}
		</a>
	);
}
