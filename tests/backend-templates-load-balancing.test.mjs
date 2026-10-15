import assert from "node:assert/strict";
import { access, mkdir, readFile, rm, rmdir, writeFile } from "node:fs/promises";
import test, { after } from "node:test";
import utils from "../backend/lib/utils.js";

const runtimeDirectories = [
	"/data",
	"/data/npmplus",
	"/data/nginx",
	"/data/nginx/proxy_host",
	"/data/nginx/redirection_host",
	"/data/nginx/dead_host",
	"/data/nginx/stream",
	"/data/custom_nginx",
	"/data/tls",
	"/data/tls/ech",
];
const runtimeFiles = [
	"/data/tls/ech/nginx.conf",
	"/data/custom_nginx/root.conf",
	"/data/custom_nginx/root_top.conf",
	"/data/custom_nginx/events.conf",
	"/data/custom_nginx/http_top.conf",
	"/data/custom_nginx/http.conf",
	"/data/custom_nginx/stream_top.conf",
	"/data/custom_nginx/stream.conf",
];
const createdDirectories = [];
const createdFiles = [];

const pathExists = async (path) => {
	try {
		await access(path);
		return true;
	} catch (error) {
		if (error.code === "ENOENT") return false;
		throw error;
	}
};

for (const directory of runtimeDirectories) {
	if (!await pathExists(directory)) {
		await mkdir(directory);
		createdDirectories.push(directory);
	}
}

for (const file of runtimeFiles) {
	if (!await pathExists(file)) {
		await writeFile(file, "");
		createdFiles.push(file);
	}
}

const keysFile = "/data/npmplus/keys-ec.json";
const keysFileExisted = await pathExists(keysFile);
const { default: internalNginx } = await import("../backend/internal/nginx.js");

after(async () => {
	if (!keysFileExisted) {
		await rm(keysFile, { force: true });
	}
	for (const file of createdFiles.reverse()) {
		await rm(file, { force: true });
	}
	for (const directory of createdDirectories.reverse()) {
		try {
			await rmdir(directory);
		} catch (error) {
			if (error.code !== "ENOENT" && error.code !== "ENOTEMPTY") throw error;
		}
	}
});

const renderTemplate = async (templateName, data) => {
	const template = await readFile(new URL(`../backend/templates/${templateName}`, import.meta.url), "utf8");
	return utils.getRenderEngine().parseAndRender(template, data);
};

const compact = (config) => config.replace(/\s+/g, " ").trim();

const assertAppearsInOrder = (text, values) => {
	let previousIndex = -1;

	for (const value of values) {
		const index = text.indexOf(value);
		assert.notEqual(index, -1, `Expected generated config to contain: ${value}`);
		assert.ok(index > previousIndex, `Expected generated config to preserve order at: ${value}`);
		previousIndex = index;
	}
};

const upstreamServer = (host, port, overrides = {}) => ({
	host,
	port,
	weight: 1,
	backup: false,
	down: false,
	...overrides,
});

const proxyHostData = (overrides = {}) => ({
	id: 42,
	domain_names: ["proxy.example.test"],
	forward_scheme: "http",
	forward_upstream_name: "upstream_42",
	npmplus_forward_path: "/forward/path",
	npmplus_upstream_servers: [upstreamServer("192.168.1.2", 8080)],
	npmplus_auth_request: "none",
	npmplus_access_list_type: "public",
	npmplus_x_frame_options: "SAMEORIGIN",
	npmplus_location_config: "",
	npmplus_directory: "",
	access_list: {
		items: [],
		clients: [],
		pass_auth: false,
		satisfy_any: false,
	},
	env: {
		IPV4_BINDING: "0.0.0.0",
		IPV6_BINDING: "[::]",
		DISABLE_IPV6: "true",
		ENABLE_MPTCP: "false",
		AUTH_REQUEST_ANUBIS_UPSTREAM: "http://127.0.0.1:3000",
		AUTH_REQUEST_TINYAUTH_UPSTREAM: "http://127.0.0.1:3001",
		AUTH_REQUEST_OAUTH2PROXY_UPSTREAM: "http://127.0.0.1:3002",
		AUTH_REQUEST_VOIDAUTH_UPSTREAM: "http://127.0.0.1:3003",
		AUTH_REQUEST_AUTHELIA_UPSTREAM: "http://127.0.0.1:3004",
		AUTH_REQUEST_AUTHENTIK_UPSTREAM: "http://127.0.0.1:3005",
	},
	...overrides,
});

const locationData = (overrides = {}) => ({
	path: "/application",
	location_type: "",
	forward_scheme: "http",
	forward_upstream_name: "upstream_42_location_0",
	npmplus_forward_path: "/location/path",
	npmplus_upstream_servers: [upstreamServer("192.168.2.2", 8081)],
	npmplus_auth_request: "none",
	npmplus_x_frame_options: "SAMEORIGIN",
	advanced_config: "",
	access_list: {
		items: [],
		clients: [],
		pass_auth: false,
		satisfy_any: false,
	},
	...overrides,
});

const streamData = (overrides = {}) => ({
	id: 73,
	incoming_port: "9000",
	tcp_forwarding: true,
	udp_forwarding: false,
	npmplus_proxy_protocol_forwarding: 0,
	npmplus_proxy_tls: false,
	npmplus_advanced_config: "",
	npmplus_upstream_servers: [upstreamServer("192.168.3.2", 9001)],
	env: {
		IPV4_BINDING: "0.0.0.0",
		IPV6_BINDING: "[::]",
		DISABLE_IPV6: "true",
		ENABLE_MPTCP: "false",
	},
	...overrides,
});

const httpLoadBalancingMethods = [
	["round_robin", null],
	["least_conn", "least_conn;"],
	["ip_hash", "ip_hash;"],
	["least_time_header", "least_time header;"],
	["least_time_last_byte", "least_time last_byte;"],
	["least_time_last_byte_inflight", "least_time last_byte inflight;"],
	["random", "random;"],
	["random_two_least_connections", "random two least_conn;"],
	["random_two_least_time_header", "random two least_time=header;"],
	["random_two_least_time_last_byte", "random two least_time=last_byte;"],
];

for (const [method, directive] of httpLoadBalancingMethods) {
	test(`HTTP upstream renders the ${method} method`, async () => {
		const output = compact(await renderTemplate("_upstream.conf", {
			forward_upstream_name: "upstream_42",
			npmplus_load_balance_method: method,
			npmplus_upstream_servers: [upstreamServer("192.168.1.2", 8080)],
		}));

		assert.match(output, /^upstream upstream_42 \{/);
		assert.match(output, /server 192\.168\.1\.2:8080 resolve;/);
		if (directive === null) {
			assert.doesNotMatch(output, /\} (least_conn|ip_hash|least_time|random)/);
		} else {
			assert.ok(output.includes(directive));
		}
	});
}

test("HTTP upstream renders every optional server parameter", async () => {
	const output = compact(await renderTemplate("_upstream.conf", {
		forward_upstream_name: "upstream_42",
		npmplus_load_balance_method: "round_robin",
		npmplus_upstream_servers: [
			upstreamServer("192.168.1.2", 8080, {
				weight: 3,
				max_conns: 20,
				max_fails: 4,
				fail_timeout: "45s",
				backup: true,
				down: true,
			}),
		],
	}));

	assert.ok(output.includes(
		"server 192.168.1.2:8080 resolve weight=3 max_conns=20 max_fails=4 fail_timeout=45s backup down;",
	));
});

test("HTTP upstream omits a null port and ignores custom-upstream entries", async () => {
	const output = compact(await renderTemplate("_upstream.conf", {
		forward_upstream_name: "upstream_42",
		npmplus_load_balance_method: "round_robin",
		npmplus_upstream_servers: [
			upstreamServer("192.168.1.2", null),
			upstreamServer("cu_external_backend", null),
			upstreamServer("[fd19:2168:ab1:1::3]", 8080),
		],
	}));

	assert.match(output, /server 192\.168\.1\.2 resolve;/);
	assert.match(output, /server \[fd19:2168:ab1:1::3\]:8080 resolve;/);
	assert.doesNotMatch(output, /cu_external_backend/);
	assertAppearsInOrder(output, [
		"server 192.168.1.2 resolve;",
		"server [fd19:2168:ab1:1::3]:8080 resolve;",
	]);
});

test("generated stream config preserves upstream order and inherits the first port", async (t) => {
	const id = 900001;
	const filename = internalNginx.getConfigName("stream", id);
	t.after(() => rm(filename, { force: true }));

	await internalNginx.generateConfig("stream", streamData({
		id,
		npmplus_load_balance_method: "round_robin",
		npmplus_upstream_servers: [
			upstreamServer("192.168.4.1", 8100),
			upstreamServer("192.168.4.2", null),
			upstreamServer("192.168.4.3", 8300),
		],
	}));

	const output = compact(await readFile(filename, "utf8"));
	assertAppearsInOrder(output, [
		"server 192.168.4.1:8100 resolve;",
		"server 192.168.4.2:8100 resolve;",
		"server 192.168.4.3:8300 resolve;",
	]);
});

test("generated portless stream config is retained and rejected by nginx", async (t) => {
	const id = 900002;
	const filename = internalNginx.getConfigName("stream", id);
	t.after(() => rm(filename, { force: true }));

	await internalNginx.generateConfig("stream", streamData({
		id,
		npmplus_upstream_servers: [
			upstreamServer("192.168.4.4", null),
		],
	}));

	const output = compact(await readFile(filename, "utf8"));
	assert.ok(output.includes("server 192.168.4.4 resolve;"));
	await assert.rejects(internalNginx.test(), /no port/i);
});

test("proxy-host config contains its generated upstream and forward path", async () => {
	const data = proxyHostData({
		npmplus_load_balance_method: "least_conn",
		npmplus_upstream_servers: [
			upstreamServer("192.168.1.2", 8080),
			upstreamServer("192.168.1.3", 8080, { backup: true }),
		],
	});
	data.upstreams = await renderTemplate("_upstream.conf", data);

	const output = compact(await renderTemplate("proxy_host.conf", data));

	assert.match(output, /upstream upstream_42 \{/);
	assert.match(output, /server 192\.168\.1\.2:8080 resolve;/);
	assert.match(output, /server 192\.168\.1\.3:8080 resolve backup;/);
	assert.ok(output.includes("proxy_pass http://upstream_42/forward/path;"));
});

test("proxy-host config sends gRPC to the generated upstream without a forward path", async () => {
	const data = proxyHostData({
		forward_scheme: "grpc",
		npmplus_forward_path: undefined,
	});
	data.upstreams = await renderTemplate("_upstream.conf", data);

	const output = compact(await renderTemplate("proxy_host.conf", data));

	assert.ok(output.includes("grpc_pass grpc://upstream_42;"));
	assert.doesNotMatch(output, /grpc_pass grpc:\/\/upstream_42\//);
});

test("proxy-host path config uses the first upstream as its filesystem target", async () => {
	const output = compact(await renderTemplate("proxy_host.conf", proxyHostData({
		forward_scheme: "path",
		forward_upstream_name: undefined,
		npmplus_forward_path: undefined,
		npmplus_upstream_servers: [upstreamServer("/srv/application/", null)],
		upstreams: "",
	})));

	assert.ok(output.includes("alias /srv/application/;"));
	assert.doesNotMatch(output, /proxy_pass (?:http|https):\/\//);
});

test("custom-location config uses its own upstream name and forward path", async () => {
	const output = compact(await renderTemplate("_proxy_host_custom_location.conf", locationData()));

	assert.match(output, /^location \/application \{/);
	assert.ok(output.includes("proxy_pass http://upstream_42_location_0/location/path;"));
});

const streamLoadBalancingMethods = [
	["round_robin", null],
	["least_conn", "least_conn;"],
	["hash", "hash $remote_addr;"],
	["hash_consistent", "hash $remote_addr consistent;"],
	["least_time_connect", "least_time connect;"],
	["least_time_first_byte", "least_time first_byte;"],
	["least_time_last_byte", "least_time last_byte;"],
	["least_time_last_byte_inflight", "least_time last_byte inflight;"],
	["random", "random;"],
	["random_two_least_connections", "random two least_conn;"],
	["random_two_least_time_connect", "random two least_time=connect;"],
	["random_two_least_time_first_byte", "random two least_time=first_byte;"],
	["random_two_least_time_last_byte", "random two least_time=last_byte;"],
];

for (const [method, directive] of streamLoadBalancingMethods) {
	test(`stream config renders the ${method} method`, async () => {
		const output = compact(await renderTemplate("stream.conf", streamData({
			npmplus_load_balance_method: method,
		})));

		assert.match(output, /upstream stream_upstream_73 \{/);
		assert.match(output, /server 192\.168\.3\.2:9001 resolve;/);
		assert.ok(output.includes("proxy_pass stream_upstream_73;"));
		if (directive === null) {
			assert.doesNotMatch(output, /\} (least_conn|hash|least_time|random)/);
		} else {
			assert.ok(output.includes(directive));
		}
	});
}

test("stream config creates both TCP and UDP servers for one upstream", async () => {
	const output = compact(await renderTemplate("stream.conf", streamData({
		tcp_forwarding: true,
		udp_forwarding: true,
	})));

	assert.ok(output.includes("listen 0.0.0.0:9000 reuseport deferred so_keepalive=on;"));
	assert.ok(output.includes("listen 0.0.0.0:9000 udp reuseport;"));
	assert.equal(output.match(/proxy_pass stream_upstream_73;/g)?.length, 2);
});

test("stream config uses a first custom upstream directly and ignores later servers", async () => {
	const output = compact(await renderTemplate("stream.conf", streamData({
		npmplus_load_balance_method: "round_robin",
		npmplus_upstream_servers: [
			upstreamServer("cu_stream_backend", null),
			upstreamServer("192.168.3.3", 9002),
		],
	})));

	assert.doesNotMatch(output, /upstream stream_upstream_73 \{/);
	assert.ok(output.includes("proxy_pass cu_stream_backend;"));
	assert.doesNotMatch(output, /192\.168\.3\.3/);
});

test("stream config uses $server_port directly without generating an upstream", async () => {
	const output = compact(await renderTemplate("stream.conf", streamData({
		incoming_port: "8000-8010",
		npmplus_upstream_servers: [upstreamServer("192.168.3.4", "$server_port")],
	})));

	assert.doesNotMatch(output, /upstream stream_upstream_73 \{/);
	assert.ok(output.includes("proxy_pass 192.168.3.4:$server_port;"));
});
