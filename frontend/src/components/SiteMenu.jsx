import {
	IconAdjustments,
	IconArrowsCross,
	IconBolt,
	IconBoltOff,
	IconChartBar,
	IconDisc,
	IconExternalLink,
	IconHistory,
	IconLock,
	IconSettings,
	IconShield,
	IconUsers,
} from "@tabler/icons-react";
import React from "react";
import { useLocation } from "react-router";
import { HasPermission, NavLink } from "src/components";
import { useUser } from "src/hooks";
import { T } from "src/locale";
import {
	ACCESS_LISTS,
	ADMIN,
	CERTIFICATES,
	DEAD_HOSTS,
	hasPermission,
	PROXY_HOSTS,
	REDIRECTION_HOSTS,
	STREAMS,
	VIEW,
} from "src/modules/Permissions";

const menuGroups = [
	[
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
	],
	[
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
	],
	[
		{
			icon: IconSettings,
			label: "settings",
			permissionSection: ADMIN,
			items: [
				{
					to: "/settings",
					icon: IconAdjustments,
					label: "settings",
				},
				{
					to: "/users",
					icon: IconUsers,
					label: "users",
				},
				{
					to: "/audit-log",
					icon: IconHistory,
					label: "auditlogs",
				},
			],
		},
		{
			href: "/goaccess",
			icon: IconChartBar,
			label: "GoAccess",
			goaccess: true,
		},
	],
];

const getMenuItem = (item, onClick, pathname) => {
	if (item.items && item.items.length > 0) {
		return getMenuDropown(item, onClick, pathname);
	}

	return (
		<li
			key={`item-${item.label}`}
			className={`nav-item${item.to && pathname.startsWith(item.to) ? " active" : ""}`}
		>
			<NavLink to={item.to} href={item.href} onClick={onClick}>
				<span className="nav-link-icon">
					{item.icon && React.createElement(item.icon, { height: 24, width: 24 })}
				</span>
				<span className="nav-link-title d-flex align-items-center gap-1">
					{item.href ? item.label : <T id={item.label} />}
					{item.href && <IconExternalLink height={16} width={16} />}
				</span>
			</NavLink>
		</li>
	);
};

const getMenuDropown = (item, onClick, pathname) => (
	<li
		key={`item-${item.label}`}
		className={`nav-item dropdown${item.items.some((subitem) => pathname.startsWith(subitem.to)) ? " active" : ""}`}
	>
		<button type="button" className="nav-link dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">
			<span className="nav-link-icon">{React.createElement(item.icon, { height: 24, width: 24 })}</span>
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
					<NavLink to={subitem.to} isDropdownItem active={pathname.startsWith(subitem.to)} onClick={onClick}>
						{React.createElement(subitem.icon, { width: 18 })}
						<T id={subitem.label} />
					</NavLink>
				</HasPermission>
			))}
		</div>
	</li>
);

export function SiteMenu() {
	const { data: user } = useUser("me");
	const { pathname } = useLocation();

	const closeMenu = () =>
		setTimeout(() => {
			const navbarToggler = document.querySelector(".navbar-toggler");
			const navbarMenu = document.querySelector("#navbar-menu");
			if (navbarToggler && navbarMenu?.classList.contains("show")) {
				navbarToggler.click();
			}
		}, 300);

	return (
		<header className="navbar-expand-lg">
			<div className="collapse navbar-collapse" id="navbar-menu">
				<div className="navbar">
					<div className="container-xl">
						<div className="row flex-column flex-md-row flex-fill align-items-center">
							<div className="col">
								<ul className="navbar-nav">
									{menuGroups
										.map((group) =>
											group.filter((item) =>
												item.goaccess
													? user?.goaccess
													: hasPermission(
															item.permissionSection,
															item.permission || VIEW,
															user?.permissions,
															user?.roles,
														),
											),
										)
										.filter((group) => group.length)
										.map((group, idx) => (
											<React.Fragment key={group[0].label}>
												{idx > 0 && (
													<li className="d-none d-lg-flex">
														<div className="vr h-50 my-auto" />
													</li>
												)}
												{group.map((item) => getMenuItem(item, closeMenu, pathname))}
											</React.Fragment>
										))}
								</ul>
							</div>
						</div>
					</div>
				</div>
			</div>
		</header>
	);
}
