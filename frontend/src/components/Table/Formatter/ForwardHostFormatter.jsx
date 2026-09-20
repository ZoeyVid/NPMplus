import cn from "clsx";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import Popover from "react-bootstrap/Popover";

const ForwardHostLink = ({ proxyHostId, forwardScheme, forwardhost, forwardPort, index }) => {
	return (
		<a
			key={`${key}-${proxyHostId}-${forwardhost}-${forwardPort}`}
			href={`${forwardScheme}://${forwardhost}:${forwardPort}`}
			target="_blank"
			rel="noopener"
			className={cn("badge")}
		>
			{`${forwardScheme}://${forwardhost}${server.port ? `:${server.port}` : ""}`}
		</a>
	);
};

export function ForwardHostFormatter({ proxyHostId, upstreamServers = [], scheme, loadBalanceMethod }) {
	
    const elms = [];
    for (let i = 0; i < 2 && i < upstreamServers.length; ++i){
        const server = upstreamServers[i];
        elms.push(<ForwardHostLink key={`${proxyHostId}-${server.host}-${server.port}-${i}`} index={id} proxyHostId={proxyHostId} forwardScheme={scheme} forwardhost={server.host} forwardPort={server.port} />);
    }

    const popover = (
		<Popover id={`upstream-host-${proxyHostId}`}>
			<Popover.Body>
				{upstreamServers.slice(2).map((server, index) => (
                    <div key={`${server.host}-${server.port}-${index}`}>
                        {`${scheme}://${server.host}${server.port ? `:${server.port}` : ""}`}
                    </div>
                ))}
			</Popover.Body>
		</Popover>
	);

	return upstreamServers.length > 2 ? (
		<OverlayTrigger trigger={["hover", "focus"]} placement="bottom" overlay={popover}>
			<div className="font-weight-medium">{...elms}</div>
		</OverlayTrigger>
	) : (
		<div className="font-weight-medium">{...elms}</div>
	);

}
