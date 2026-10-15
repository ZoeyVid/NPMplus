import cn from "clsx";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import Popover from "react-bootstrap/Popover";
import { T } from "src/locale";
import { isCustomUpstream } from "src/modules/Forward";

function getPort (forwardPort) {
    return `${forwardPort ? `:${forwardPort}` : ""}`;
}

const ForwardHostLink = ({ forwardScheme, forwardhost, forwardPort, forwardPath, streams }) => {
	const serverPath=`${forwardhost}${getPort(forwardPort)}`;
	return streams ? (
	<>
		{serverPath}
	</>
	): (
		<a
			href={`${forwardScheme}://${serverPath}${forwardPath ?? ""}`}
			target="_blank"
			rel="noopener"
			className={cn("badge")}
		>
			{`${forwardScheme}://${serverPath}${forwardPath ?? ""}`}
		</a>
	);
};

export function ForwardHostFormatter({ hostRowId, upstreamServers = [], scheme="", forwardPath="", loadBalanceMethod, streams=false }) {
	const customUpstream = isCustomUpstream(upstreamServers);
    const elms = [];
    for (let i = 0; i < 2 && i < upstreamServers.length; ++i){
        const server = upstreamServers[i];
        elms.push(<ForwardHostLink key={`${hostRowId}-${server.host}-${server.port}${forwardPath ?? ""}-${i}`} streams={streams} forwardScheme={scheme} forwardhost={server.host} forwardPort={server.port} forwardPath={forwardPath} />);
    }

    const popover = (
		<Popover id={`upstream-host-${hostRowId}`}>
			<Popover.Body>
				{customUpstream ?
					(
						<span className="bg-yellow-lt">
							<T id="host.custom-upstream-used" />
						</span>
					): null}
				{upstreamServers.slice(2).map((server, index) => (
                    <div key={`${server.host}-${server.port}-${index}`}>
                        {`${streams ? "" : `${scheme}://`}${server.host}${getPort(server.port)}${forwardPath ?? ""}`}
                    </div>
                ))}
			</Popover.Body>
		</Popover>
	);

	const customUpstreamPopover = (
		<Popover id={`upstream-host-${hostRowId}`}>
			<Popover.Body>
				<span className="bg-yellow-lt">
					<T id="host.custom-upstream-used" />
				</span>
			</Popover.Body>
		</Popover>
	);

	return upstreamServers.length > 2 ? 
	(
		<OverlayTrigger trigger={["hover", "focus"]} placement="bottom" overlay={popover}>
			<div className={cn("font-weight-medium", "d-flex", "flex-column", "align-items-start", "gap-1", customUpstream && "badge")}>{...elms}</div>
		</OverlayTrigger>
	) : customUpstream ? (
		<OverlayTrigger trigger={["hover", "focus"]} placement="bottom" overlay={customUpstreamPopover}>
			<div className="font-weight-medium d-flex flex-column align-items-start gap-1 badge">{...elms}</div>
		</OverlayTrigger>
	) : (
		<div className="font-weight-medium d-flex flex-column align-items-start gap-1">{...elms}</div>
	);
}
