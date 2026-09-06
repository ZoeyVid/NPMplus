// Minimal private Prometheus endpoint for the CrowdSec dashboard smoke test.
import http from "node:http";

const body = `# HELP cs_parser_hits_total Parser hits
cs_parser_hits_total{source="nginx"} 10
cs_parser_hits_ok_total{source="nginx"} 9
cs_appsec_reqs_total 12
cs_appsec_block_total 3
cs_lapi_bouncer_requests_total{bouncer="npmplus"} 20
cs_lapi_decisions_ok_total 12
cs_lapi_machine_requests_total{machine="npmplus-ui"} 8
cs_lapi_request_duration_seconds_sum 1.5
cs_lapi_request_duration_seconds_count 3
cs_active_decisions{origin="crowdsec",action="ban"} 1
cs_active_decisions{origin="cscli",action="ban"} 2
cs_active_decisions{origin="CAPI",action="ban"} 42000
cs_active_decisions{origin="lists",action="ban"} 100
cs_alerts 7
`;

const server = http.createServer((req, res) => {
	if (req.method !== "GET" || req.url !== "/metrics") {
		res.writeHead(404).end();
		return;
	}
	res.writeHead(200, { "Content-Type": "text/plain; version=0.0.4" });
	res.end(body);
});

const start = async () => {
	await new Promise((resolve) => server.listen(18082, "127.0.0.1", resolve));
	console.log("fake metrics on 18082");
};

const stop = async () => {
	await new Promise((resolve) => server.close(resolve));
};

export { start, stop };
