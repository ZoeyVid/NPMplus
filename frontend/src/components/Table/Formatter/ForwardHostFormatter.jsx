import cn from "clsx";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import Popover from "react-bootstrap/Popover";
import { T } from "src/locale";
import { forwardDestination, hasCustomUpstream, isCustomUpstream } from "src/modules/Forward";

const ForwardHostLink = ({ item, server, streams }) => {
	const destination = forwardDestination(item, server, { streams });
	const isNetworkDestination =
		!streams && ["http", "https", "grpc", "grpcs"].includes(item.forwardScheme);

	return isNetworkDestination ? (
		<a href={destination} target="_blank" rel="noopener" className={cn("badge")}>
			{destination}
		</a>
	) : (
		<span>{destination}</span>
	);
};

export function ForwardHostFormatter({
	hostRowId,
	upstreamServers = [],
	scheme = "",
	forwardPath = "",
	locations = [],
	streams = false,
}) {
	const usesCustomUpstream = isCustomUpstream(upstreamServers);
	const containsCustomUpstream = hasCustomUpstream(upstreamServers);
	const locationUsesCustomUpstream = locations.some(
		(location) => location.npmplusEnabled !== false && isCustomUpstream(location.npmplusUpstreamServers),
	);
	const locationContainsCustomUpstream = locations.some(
		(location) => location.npmplusEnabled !== false && hasCustomUpstream(location.npmplusUpstreamServers),
	);
	const item = {
		forwardScheme: scheme,
		npmplusForwardPath: forwardPath,
		npmplusUpstreamServers: upstreamServers,
	};
	const elms = [];
	for (let i = 0; i < 2 && i < upstreamServers.length; ++i) {
		const server = upstreamServers[i];
		elms.push(
			<ForwardHostLink
				key={`${hostRowId}-${server.host}-${server.port}${forwardPath ?? ""}-${i}`}
				item={item}
				server={server}
				streams={streams}
			/>,
		);
	}

	const popover = (
		<Popover id={`upstream-host-${hostRowId}`}>
			<Popover.Body>
				{usesCustomUpstream ? (
					<div className="bg-yellow-lt">
						<T id="host.custom-upstream-used" />
					</div>
				) : containsCustomUpstream ? (
					<div className="row bg-blue-lt">
						<T id="host.custom-upstream-unused" />
					</div>
				) : null}
				{locationUsesCustomUpstream ? (
					<div className="bg-yellow-lt">
						<T id="host.location-custom-upstream-used" />
					</div>
				) : locationContainsCustomUpstream ? (
					<div className="row bg-blue-lt">
						<T id="host.location-custom-upstream-unused" />
					</div>
				) : null}
				{upstreamServers.length > 2 &&
					upstreamServers
						.slice(2)
						.map((server, index) => (
							<div key={`${server.host}-${server.port}-${index}`}>
								{forwardDestination(item, server, { streams })}
							</div>
						))}
			</Popover.Body>
		</Popover>
	);

	return upstreamServers.length > 2 || usesCustomUpstream || locationUsesCustomUpstream ? (
		<OverlayTrigger trigger={["hover", "focus"]} placement="bottom" overlay={popover}>
			<div
				className={cn(
					"font-weight-medium",
					"d-flex",
					"flex-column",
					"align-items-start",
					"gap-1",
					usesCustomUpstream && "badge",
					containsCustomUpstream && !usesCustomUpstream && "bg-blue-lt",
				)}
			>
				{...elms}
			</div>
		</OverlayTrigger>
	) : (
		<div className="font-weight-medium d-flex flex-column align-items-start gap-1">{...elms}</div>
	);
}
