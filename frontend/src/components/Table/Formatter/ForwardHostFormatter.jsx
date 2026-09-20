import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import Popover from "react-bootstrap/Popover";
import { intl } from "src/locale";
import { showAccessListModal, showProxyHostModal } from "src/modals";


const ForwardHostLink = ({ forwardScheme, forwardhost, forwardPort }) => {
	return (
		<a
			key={forwardhost}
			href={`${forwardScheme}://${forwardhost}:${forwardPort}`}
			target="_blank"
			rel="noopener"
			className={cn("badge", color ? `bg-${color}-lt` : null)}
		>
			`${forwardScheme}://${forwardhost}:${forwardPort}`
		</a>
	);
};

export function ForwardHostFormatter({ proxyHostId, upstreamServers, scheme, loadBalanceMethod }) {
	
    const elms = [];
    for (i = 0; i < 2 && i < upstreamServers.length; ++i){
        const server = upstreamServers[i];
        elms.push(<ForwardHostLink forwardScheme={scheme} forwardhost={server.host} forwardPort={server.port} />);
    }

    const popover = (
		<Popover id={`upstream-host-${server.host}`}>
			<Popover.Body>
				{upstreamServers.map((server) => (
                    //TODO strip the first 2 elements
					<div key={`${server.host}-${server.port}`}>`${scheme}://${server.host}:${server.port}`</div>
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
