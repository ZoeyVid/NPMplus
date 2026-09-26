import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import Popover from "react-bootstrap/Popover";
import { TrueFalseFormatter } from "src/components";
import { T } from "src/locale";

const getSection = (title, items) => {
	if (items.length === 0) {
		return null;
	}
	return (
		<>
			<div>
				<strong>
					<T id={title} />
				</strong>
			</div>
			{items.map((host) => (
				<div key={host.id} className="ms-1">
					{host.domainNames.join(", ")}
				</div>
			))}
		</>
	);
};

const getSectionStream = (items) => {
	if (items.length === 0) {
		return null;
	}
	return (
		<>
			<div>
				<strong>
					<T id="streams" />
				</strong>
			</div>
			{items.map((stream) => (
				<div key={stream.id} className="ms-1">
					{(stream.npmplusUpstreamServers ?? []).map((server) => `${server.host}${server.port ? `:${server.port}` : ""}`).join(", ")}
				</div>
			))}
		</>
	);
};

export function CertificateInUseFormatter({
	proxyHosts = [],
	redirectionHosts = [],
	deadHosts = [],
	streams = [],
	mtlsInUse = false,
}) {
	const totalCount = proxyHosts.length + redirectionHosts.length + deadHosts.length + streams.length;
	if (totalCount === 0 && !mtlsInUse) {
		return <TrueFalseFormatter value={false} falseLabel="certificate.not-in-use" />;
	}
	if (totalCount === 0 && mtlsInUse) {
		return <TrueFalseFormatter value trueLabel="certificate.in-use" />;
	}

	proxyHosts.sort();
	redirectionHosts.sort();
	deadHosts.sort();
	streams.sort();

	const popover = (
		<Popover id="popover-basic">
			<Popover.Body>
				{getSection("proxy-hosts", proxyHosts)}
				{getSection("redirection-hosts", redirectionHosts)}
				{getSection("dead-hosts", deadHosts)}
				{getSectionStream(streams)}
			</Popover.Body>
		</Popover>
	);

	return (
		<OverlayTrigger trigger={["hover", "click", "focus"]} placement="bottom" overlay={popover}>
			<div>
				<TrueFalseFormatter value trueLabel="certificate.in-use" />
			</div>
		</OverlayTrigger>
	);
}
