import cn from "clsx";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import Popover from "react-bootstrap/Popover";
import { T } from "src/locale";
import { forwardDestination, isCustomUpstream, hasCustomUpstream } from "src/modules/Forward";

const ForwardHostLink = ({ item, server, streams }) => {
	const destination = forwardDestination(item, server, { streams });

	return streams ? (
		<>{destination}</>
	) : (
		<a href={destination} target="_blank" rel="noopener" className={cn("badge")}>
			{destination}
		</a>
	);
};

export function ForwardHostFormatter({ hostRowId, upstreamServers = [], scheme="", forwardPath="", loadBalanceMethod, streams=false }) {
	const customUpstream = isCustomUpstream(upstreamServers);
	const containsCustomUpstream = hasCustomUpstream(servers);

	const item = {
		forwardScheme: scheme,
		npmplusForwardPath: forwardPath,
		npmplusUpstreamServers: upstreamServers
	};
    const elms = [];
    for (let i = 0; i < 2 && i < upstreamServers.length; ++i){
        const server = upstreamServers[i];
        elms.push(<ForwardHostLink key={`${hostRowId}-${server.host}-${server.port}${forwardPath ?? ""}-${i}`} item={item} server={server} streams={streams} />);
    }

    const popover = (
		<Popover id={`upstream-host-${hostRowId}`}>
			<Popover.Body>
				{customUpstream ? (
					<span className="bg-yellow-lt">
						<T id="host.custom-upstream-used" />
					</span>
				) : containsCustomUpstream ? (
					<div className="row bg-blue-lt">
						<T id="host.custom-upstream-unused" />
					</div>
				) : null}
				{upstreamServers.length > 2 && upstreamServers.slice(2).map((server, index) => (
                    <div key={`${server.host}-${server.port}-${index}`}>
                        {forwardDestination(item, server, { streams })}
                    </div>
                ))}
			</Popover.Body>
		</Popover>
	);

	return upstreamServers.length > 2 || customUpstream? 
	(
		<OverlayTrigger trigger={["hover", "focus"]} placement="bottom" overlay={popover}>
			<div className={cn("font-weight-medium", "d-flex", "flex-column", "align-items-start", "gap-1", customUpstream && "badge", containsCustomUpstream && !customUpstream && "bg-blue-lt")}>{...elms}</div>
		</OverlayTrigger>
	) : (
		<div className="font-weight-medium d-flex flex-column align-items-start gap-1">{...elms}</div>
	);
}
