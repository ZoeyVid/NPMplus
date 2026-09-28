import assert from "node:assert/strict";
import test from "node:test";
import internalUpstreamServers from "../backend/internal/upstream-servers.js";

const clone = (value) => structuredClone(value);

const expectValidationError = (fn, message) => {
	assert.throws(fn, (error) => {
		assert.equal(error.message, message);
		assert.equal(error.status, 400);
		assert.equal(error.public, true);
		return true;
	});
};

const server = (host, overrides = {}) => ({ host, ...overrides });

test("cleanUpstreamServers normalises IPv6 hosts recursively", () => {
	const data = {
		npmplus_upstream_servers: [server("fd19:2168:0ab1:1::1/path")],
		locations: [
			{
				npmplus_upstream_servers: [server("fd19:2168:0ab1:1::2")],
			},
		],
	};

	const result = internalUpstreamServers.cleanUpstreamServers(data);

	assert.strictEqual(result, data);
	assert.equal(result.npmplus_upstream_servers[0].host, "[fd19:2168:0ab1:1::1]/path");
	assert.equal(result.locations[0].npmplus_upstream_servers[0].host, "[fd19:2168:0ab1:1::2]");
});

const cleanMethodScenarios = [
	{
		name: "sets the root load-balancing method to null for one server",
		isLocation: false,
		input: {
			npmplus_load_balance_method: "round_robin",
			npmplus_upstream_servers: [server("one.example.com")],
		},
		expectedHasMethod: true,
		expectedMethod: null,
	},
	{
		name: "removes a location load-balancing method for one server",
		isLocation: true,
		input: {
			npmplus_load_balance_method: "round_robin",
			npmplus_upstream_servers: [server("one.example.com")],
		},
		expectedHasMethod: false,
	},
	{
		name: "preserves the method for multiple servers",
		isLocation: false,
		input: {
			npmplus_load_balance_method: "round_robin",
			npmplus_upstream_servers: [server("one.example.com"), server("two.example.com")],
		},
		expectedHasMethod: true,
		expectedMethod: "round_robin",
	},
];

for (const scenario of cleanMethodScenarios) {
	test(`cleanUpstreamServers ${scenario.name}`, () => {
		const result = internalUpstreamServers.cleanUpstreamServers(
			clone(scenario.input),
			scenario.isLocation,
		);

		assert.equal(
			Object.hasOwn(result, "npmplus_load_balance_method"),
			scenario.expectedHasMethod,
		);
		if (scenario.expectedHasMethod) {
			assert.equal(result.npmplus_load_balance_method, scenario.expectedMethod);
		}
	});
}

const splitScenarios = [
	{
		name: "extracts an HTTP path from the first upstream",
		input: {
			forward_scheme: "http",
			npmplus_upstream_servers: [server("10.0.0.5/test/path")],
		},
		expectedPath: "/test/path",
		expectedHosts: ["10.0.0.5"],
	},
	{
		name: "extracts an HTTPS bare trailing slash",
		input: {
			forward_scheme: "https",
			npmplus_upstream_servers: [server("example.com/")],
		},
		expectedPath: "/",
		expectedHosts: ["example.com"],
	},
	{
		name: "makes the first upstream path shared when multiple servers exist",
		input: {
			forward_scheme: "http",
			npmplus_upstream_servers: [
				server("one.example.com/shared/path"),
				server("two.example.com"),
			],
		},
		expectedPath: "/shared/path",
		expectedHosts: ["one.example.com", "two.example.com"],
	},
	{
		name: "uses the existing scheme during a partial update",
		input: {
			npmplus_upstream_servers: [server("example.com/partial/path")],
		},
		existing: {
			forward_scheme: "http",
			npmplus_forward_path: null,
		},
		expectedPath: "/partial/path",
		expectedHosts: ["example.com"],
	},
	{
		name: "does not split a gRPC host",
		input: {
			forward_scheme: "grpc",
			npmplus_upstream_servers: [server("grpc.example.com/path")],
		},
		expectedPath: undefined,
		expectedHosts: ["grpc.example.com/path"],
	},
	{
		name: "does not split a path-scheme host",
		input: {
			forward_scheme: "path",
			npmplus_upstream_servers: [server("/srv/application")],
		},
		expectedPath: undefined,
		expectedHosts: ["/srv/application"],
	},
	{
		name: "does not split a full URL entered as a host",
		input: {
			forward_scheme: "http",
			npmplus_upstream_servers: [server("http://example.com/path")],
		},
		expectedPath: undefined,
		expectedHosts: ["http://example.com/path"],
	},
];

for (const scenario of splitScenarios) {
	test(`splitHostAndPath ${scenario.name}`, () => {
		const input = clone(scenario.input);
		const result = internalUpstreamServers.splitHostAndPath(
			input,
			clone(scenario.existing ?? {}),
		);

		assert.strictEqual(result, input);
		assert.equal(result.npmplus_forward_path, scenario.expectedPath);
		assert.deepEqual(
			result.npmplus_upstream_servers.map(({ host }) => host),
			scenario.expectedHosts,
		);
	});
}

const splitConflictScenarios = [
	{
		name: "a submitted forward path",
		input: {
			forward_scheme: "http",
			npmplus_forward_path: "/explicit/path",
			npmplus_upstream_servers: [server("example.com/embedded/path")],
		},
		existing: {},
	},
	{
		name: "an existing forward path during a partial update",
		input: {
			npmplus_upstream_servers: [server("example.com/embedded/path")],
		},
		existing: {
			forward_scheme: "https",
			npmplus_forward_path: "/existing/path",
		},
	},
];

for (const scenario of splitConflictScenarios) {
	test(`splitHostAndPath rejects an embedded path with ${scenario.name}`, () => {
		expectValidationError(
			() => internalUpstreamServers.splitHostAndPath(
				clone(scenario.input),
				clone(scenario.existing),
			),
			"An upstream host path cannot be used when the forward path field already has a value",
		);
	});
}

test("splitHostAndPath processes custom locations recursively", () => {
	const input = {
		forward_scheme: "http",
		npmplus_upstream_servers: [server("root.example.com/root/path")],
		locations: [
			{
				forward_scheme: "https",
				npmplus_upstream_servers: [server("location.example.com/location/path")],
			},
		],
	};

	const result = internalUpstreamServers.splitHostAndPath(input);

	assert.equal(result.npmplus_forward_path, "/root/path");
	assert.equal(result.npmplus_upstream_servers[0].host, "root.example.com");
	assert.equal(result.locations[0].npmplus_forward_path, "/location/path");
	assert.equal(result.locations[0].npmplus_upstream_servers[0].host, "location.example.com");
});

const validLoadBalancingScenarios = [
	{
		name: "one HTTP upstream without a method",
		input: {
			forward_scheme: "http",
			npmplus_upstream_servers: [server("one.example.com")],
		},
	},
	{
		name: "multiple HTTP upstreams with a method",
		input: {
			forward_scheme: "http",
			npmplus_load_balance_method: "round_robin",
			npmplus_upstream_servers: [server("one.example.com"), server("two.example.com")],
		},
	},
	{
		name: "one path upstream",
		input: {
			forward_scheme: "path",
			npmplus_upstream_servers: [server("/srv/application")],
		},
	},
	{
		name: "one empty-scheme upstream",
		input: {
			forward_scheme: "empty",
			npmplus_upstream_servers: [server("unix:/run/application.sock")],
		},
	},
	{
		name: "an HTTP forward path",
		input: {
			forward_scheme: "http",
			npmplus_forward_path: "/application",
			npmplus_upstream_servers: [server("example.com")],
		},
	},
	{
		name: "backup with a compatible method",
		input: {
			forward_scheme: "http",
			npmplus_load_balance_method: "round_robin",
			npmplus_upstream_servers: [server("one.example.com"), server("two.example.com", { backup: true })],
		},
	},
	{
		name: "one stream using $server_port",
		input: {
			npmplus_upstream_servers: [server("stream.example.com", { port: "$server_port" })],
		},
		streams: true,
	},
	{
		name: "a partial update using the existing upstreams and scheme",
		input: {
			npmplus_load_balance_method: "least_conn",
		},
		existing: {
			forward_scheme: "https",
			npmplus_load_balance_method: "round_robin",
			npmplus_upstream_servers: [server("one.example.com"), server("two.example.com")],
		},
	},
	{
		name: "a partial update explicitly clearing the forward path before changing scheme",
		input: {
			forward_scheme: "grpc",
			npmplus_forward_path: null,
		},
		existing: {
			forward_scheme: "http",
			npmplus_forward_path: "/old/path",
			npmplus_upstream_servers: [server("grpc.example.com")],
		},
	},
];

for (const scenario of validLoadBalancingScenarios) {
	test(`validateLoadBalancing accepts ${scenario.name}`, () => {
		assert.doesNotThrow(() => internalUpstreamServers.validateLoadBalancing(
			clone(scenario.input),
			clone(scenario.existing ?? {}),
			scenario.streams ?? false,
		));
	});
}

const invalidLoadBalancingScenarios = [
	{
		name: "a gRPC forward path",
		input: {
			forward_scheme: "grpc",
			npmplus_forward_path: "/invalid",
			npmplus_upstream_servers: [server("grpc.example.com")],
		},
		message: "A forward path cannot be used with the grpc scheme",
	},
	{
		name: "multiple path-scheme upstreams",
		input: {
			forward_scheme: "path",
			npmplus_load_balance_method: "round_robin",
			npmplus_upstream_servers: [server("/one"), server("/two")],
		},
		message: "path proxy hosts must have exactly one upstream server",
	},
	{
		name: "no empty-scheme upstreams",
		input: {
			forward_scheme: "empty",
			npmplus_upstream_servers: [],
		},
		message: "empty proxy hosts must have exactly one upstream server",
	},
	{
		name: "$server_port on a proxy host",
		input: {
			forward_scheme: "http",
			npmplus_upstream_servers: [server("example.com", { port: "$server_port" })],
		},
		message: "$server_port can only be used by a stream with exactly one upstream server",
	},
	{
		name: "$server_port in a stream with multiple upstreams",
		input: {
			npmplus_load_balance_method: "round_robin",
			npmplus_upstream_servers: [
				server("one.example.com", { port: "$server_port" }),
				server("two.example.com", { port: 8080 }),
			],
		},
		streams: true,
		message: "$server_port can only be used by a stream with exactly one upstream server",
	},
	{
		name: "an embedded HTTP upstream path",
		input: {
			forward_scheme: "http",
			npmplus_upstream_servers: [server("example.com/invalid/path")],
		},
		message: "Network upstream hosts cannot contain a path; use the forward path field instead",
	},
	{
		name: "a second upstream containing a path after the first was split",
		prepare: (input) => internalUpstreamServers.splitHostAndPath(input),
		input: {
			forward_scheme: "http",
			npmplus_load_balance_method: "round_robin",
			npmplus_upstream_servers: [
				server("one.example.com/shared/path"),
				server("two.example.com/other/path"),
			],
		},
		message: "Network upstream hosts cannot contain a path; use the forward path field instead",
	},
	{
		name: "multiple upstreams without a method",
		input: {
			forward_scheme: "https",
			npmplus_upstream_servers: [server("one.example.com"), server("two.example.com")],
		},
		message: "A load balancing method is required when multiple upstream servers are configured",
	},
	{
		name: "one upstream with a method",
		input: {
			forward_scheme: "https",
			npmplus_load_balance_method: "least_conn",
			npmplus_upstream_servers: [server("one.example.com")],
		},
		message: "A load balancing method cannot be used with a single upstream server",
	},
	{
		name: "backup with an incompatible random method",
		input: {
			forward_scheme: "http",
			npmplus_load_balance_method: "random",
			npmplus_upstream_servers: [server("one.example.com"), server("two.example.com", { backup: true })],
		},
		message: "The backup parameter cannot be used with the random load balancing method",
	},
	{
		name: "a partial scheme change retaining an existing forward path",
		input: {
			forward_scheme: "grpc",
		},
		existing: {
			forward_scheme: "http",
			npmplus_forward_path: "/existing/path",
			npmplus_upstream_servers: [server("grpc.example.com")],
		},
		message: "A forward path cannot be used with the grpc scheme",
	},
	{
		name: "a partial update clearing a required method",
		input: {
			npmplus_load_balance_method: null,
		},
		existing: {
			forward_scheme: "http",
			npmplus_load_balance_method: "round_robin",
			npmplus_upstream_servers: [server("one.example.com"), server("two.example.com")],
		},
		message: "A load balancing method is required when multiple upstream servers are configured",
	},
];

for (const scenario of invalidLoadBalancingScenarios) {
	test(`validateLoadBalancing rejects ${scenario.name}`, () => {
		let input = clone(scenario.input);
		if (scenario.prepare) {
			input = scenario.prepare(input);
		}

		expectValidationError(
			() => internalUpstreamServers.validateLoadBalancing(
				input,
				clone(scenario.existing ?? {}),
				scenario.streams ?? false,
			),
			scenario.message,
		);
	});
}

test("validateLoadBalancing validates custom locations recursively", () => {
	const input = {
		forward_scheme: "http",
		npmplus_upstream_servers: [server("root.example.com")],
		locations: [
			{
				forward_scheme: "http",
				npmplus_upstream_servers: [server("one.example.com"), server("two.example.com")],
			},
		],
	};

	expectValidationError(
		() => internalUpstreamServers.validateLoadBalancing(input),
		"A load balancing method is required when multiple upstream servers are configured",
	);
});
