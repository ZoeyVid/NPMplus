import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import $RefParser from "@apidevtools/json-schema-ref-parser";
import Ajv from "ajv/dist/2020.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const schema = await $RefParser.dereference(resolve(
	__dirname,
	"../backend/schema/components/load-balancing.json",
), {
	mutateInputSchema: false,
});
const ajv = new Ajv({
	allowUnionTypes: true,
	strict: false,
});
const validate = ajv.compile(schema.$defs.upstreamServers);

const assertValid = (servers) => {
	assert.equal(validate(structuredClone(servers)), true, ajv.errorsText(validate.errors));
};

const assertInvalid = (servers) => {
	assert.equal(validate(structuredClone(servers)), false);
};

const generatedServer = (host, overrides = {}) => ({ host, custom: false, ...overrides });
const customServer = (host) => ({ host, custom: true });

const validEnabledScenarios = [
	{
		name: "one generated upstream with down omitted",
		servers: [generatedServer("one.example.com")],
	},
	{
		name: "one explicitly enabled generated upstream",
		servers: [generatedServer("one.example.com", { down: false })],
	},
	{
		name: "only custom upstreams",
		servers: [customServer("primary_backend"), customServer("secondary_backend")],
	},
	{
		name: "an enabled generated upstream after a custom upstream",
		servers: [customServer("unused_backend"), generatedServer("one.example.com")],
	},
	{
		name: "one enabled generated upstream among disabled generated and custom upstreams",
		servers: [
			generatedServer("one.example.com", { down: true }),
			customServer("unused_backend"),
			generatedServer("two.example.com", { down: false }),
		],
	},
	{
		name: "a cu_-prefixed generated upstream",
		servers: [generatedServer("cu_regular_backend", { port: 8080 })],
	},
];

for (const scenario of validEnabledScenarios) {
	test(`upstream schema accepts ${scenario.name}`, () => {
		assertValid(scenario.servers);
	});
}

const invalidEnabledScenarios = [
	{
		name: "one disabled generated upstream",
		servers: [generatedServer("one.example.com", { down: true })],
	},
	{
		name: "a disabled generated upstream with a custom upstream",
		servers: [
			generatedServer("one.example.com", { down: true }),
			customServer("unused_backend"),
		],
	},
	{
		name: "multiple disabled generated upstreams with a custom upstream first",
		servers: [
			customServer("unused_backend"),
			generatedServer("one.example.com", { down: true }),
			generatedServer("two.example.com", { down: true }),
		],
	},
];

for (const scenario of invalidEnabledScenarios) {
	test(`upstream schema rejects ${scenario.name}`, () => {
		assertInvalid(scenario.servers);
	});
}

const forbiddenCustomUpstreamFields = [
	["port", 8080],
	["weight", 2],
	["max_fails", 2],
	["max_conns", 2],
	["fail_timeout", "30s"],
	["backup", true],
	["down", true],
];

for (const [field, value] of forbiddenCustomUpstreamFields) {
	test(`custom upstream schema rejects the ${field} field`, () => {
		assertInvalid([{ ...customServer("primary_backend"), [field]: value }]);
	});
}

test("upstream schema requires the custom flag", () => {
	assertInvalid([{ host: "one.example.com" }]);
});
