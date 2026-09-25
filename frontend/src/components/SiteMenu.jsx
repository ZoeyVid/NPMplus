import {
	IconArrowsCross,
	IconBolt,
	IconBoltOff,
	IconChartBar,
	IconDisc,
	IconExternalLink,
	IconLock,
	IconSettings,
	IconShield,
} from "@tabler/icons-react";
import React from "react";
import { HasPermission, NavLink } from "src/components";
import { useUser } from "src/hooks";
import { T } from "src/locale";
import {
	ACCESS_LISTS,
	ADMIN,
	CERTIFICATES,
	DEAD_HOSTS,
	PROXY_HOSTS,
	REDIRECTION_HOSTS,
	STREAMS,
	VIEW,
} from "src/modules/Permissions";

const menuItems = [
	{
		to: "/nginx/proxy",
		icon: IconBolt,
		label: "proxy-hosts",
		permissionSection: PROXY_HOSTS,
		permission: VIEW,
	},
	{
		to: "/nginx/redirection",
		icon: IconArrowsCross,
		label: "redirection-hosts",
		permissionSection: REDIRECTION_HOSTS,
		permission: VIEW,
	},
	{
		to: "/nginx/404",
		icon: IconBoltOff,
		label: "dead-hosts",
		permissionSection: DEAD_HOSTS,
		permission: VIEW,
	},
	{
		to: "/nginx/stream",
		icon: IconDisc,
		label: "streams",
		permissionSection: STREAMS,
		permission: VIEW,
	},
	{
		to: "/certificates",
		icon: IconShield,
		label: "certificates",
		permissionSection: CERTIFICATES,
		permission: VIEW,
	},
	{
		to: "/access",
		icon: IconLock,
		label: "access-lists",
		permissionSection: ACCESS_LISTS,
		permission: VIEW,
	},
	{
		icon: IconSettings,
		label: "settings",
		permissionSection: ADMIN,
		items: [
			{
				to: "/settings",
				label: "settings",
			},
			{
				to: "/users",
				label: "users",
			},
			{
				to: "/audit-log",
				label: "auditlogs",
			},
		],
	},
];

const getMenuItem = (item, onClick) => {
	if (item.items && item.items.length > 0) {
		return getMenuDropown(item, onClick);
	}

	return (
		<HasPermission
			key={`item-${item.label}`}
			section={item.permissionSection}
			permission={item.permission || VIEW}
			hideError
		>
			<li className="nav-item">
				<NavLink to={item.to} href={item.href} onClick={onClick}>
					<span className="nav-link-icon d-md-none d-lg-inline-block">
						{item.icon && React.createElement(item.icon, { height: 24, width: 24 })}
					</span>
					<span className="nav-link-title d-flex align-items-center gap-1">
						{item.href ? item.label : <T id={item.label} />}
						{item.href && <IconExternalLink height={16} width={16} />}
					</span>
				</NavLink>
			</li>
		</HasPermission>
	);
};

const getMenuDropown = (item, onClick) => (
	<HasPermission
		key={`item-${item.label}`}
		section={item.permissionSection}
		permission={item.permission || VIEW}
		hideError
	>
		<li className="nav-item dropdown">
			<button type="button" className="nav-link dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">
				<span className="nav-link-icon d-md-none d-lg-inline-block">
					{React.createElement(item.icon, { height: 24, width: 24 })}
				</span>
				<span className="nav-link-title">
					<T id={item.label} />
				</span>
			</button>
			<div className="dropdown-menu">
				{item.items?.map((subitem, idx) => (
					<HasPermission
						key={`${idx}-${subitem.to}`}
						section={subitem.permissionSection}
						permission={subitem.permission || VIEW}
						hideError
					>
						<NavLink to={subitem.to} isDropdownItem onClick={onClick}>
							<T id={subitem.label} />
						</NavLink>
					</HasPermission>
				))}
			</div>
		</li>
	</HasPermission>
);

export function SiteMenu() {
	const { data: user } = useUser("me");

	const closeMenu = () =>
		setTimeout(() => {
			const navbarToggler = document.querySelector(".navbar-toggler");
			const navbarMenu = document.querySelector("#navbar-menu");
			if (navbarToggler && navbarMenu?.classList.contains("show")) {
				navbarToggler.click();
			}
		}, 300);

	return (
		<header className="navbar-expand-md">
			<div className="collapse navbar-collapse" id="navbar-menu">
				<div className="navbar">
					<div className="container-xl">
						<div className="row flex-column flex-md-row flex-fill align-items-center">
							<div className="col">
								<ul className="navbar-nav">
									{[
										...menuItems,
										...(user?.goaccess
											? [
													{
														href: "/goaccess",
														icon: IconChartBar,
														label: "GoAccess",
														permissionSection: ADMIN,
													},
												]
											: []),
									].map((item) => getMenuItem(item, closeMenu))}
								</ul>
							</div>
						</div>
					</div>
				</div>
			</div>
		</header>
	);
}
