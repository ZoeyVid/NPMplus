import cn from "clsx";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import Popover from "react-bootstrap/Popover";

function getPort (forwardPort) {
    return `${forwardPort ? `:${forwardPort}` : ""}`;
}


const ForwardHostLink = ({ forwardScheme, forwardhost, forwardPort }) => {

	return (
		<a
			href={`${forwardScheme}://${forwardhost}${getPort(forwardPort)}`}
			target="_blank"
			rel="noopener"
			className={cn("badge")}
		>
			{`${forwardScheme}://${forwardhost}${getPort(forwardPort)}`}
		</a>
	);
};

export function ForwardHostFormatter({ proxyHostId, upstreamServers = [], scheme, loadBalanceMethod }) {
	
    const elms = [];
    for (let i = 0; i < 2 && i < upstreamServers.length; ++i){
        const server = upstreamServers[i];
        elms.push(<ForwardHostLink key={`${proxyHostId}-${server.host}-${server.port}-${i}`} forwardScheme={scheme} forwardhost={server.host} forwardPort={server.port} />);
    }

    const popover = (
		<Popover id={`upstream-host-${proxyHostId}`}>
			<Popover.Body>
				{upstreamServers.slice(2).map((server, index) => (
                    <div key={`${server.host}-${server.port}-${index}`}>
                        {`${scheme}://${server.host}${getPort(server.port)}`}
                    </div>
                ))}
			</Popover.Body>
		</Popover>
	);

	return upstreamServers.length > 2 ? (
		<OverlayTrigger trigger={["hover", "focus"]} placement="bottom" overlay={popover}>
			<div className="font-weight-medium d-flex flex-column align-items-start gap-1">{...elms}</div>
		</OverlayTrigger>
	) : (
		<div className="font-weight-medium d-flex flex-column align-items-start gap-1">{...elms}</div>
	);

}
