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

const validEnabledScenarios = [
	{
		name: "one generated upstream with down omitted",
		servers: [{ host: "one.example.com" }],
	},
	{
		name: "one explicitly enabled generated upstream",
		servers: [{ host: "one.example.com", down: false }],
	},
	{
		name: "only custom upstreams",
		servers: [{ host: "cu_primary" }, { host: "cu_secondary" }],
	},
	{
		name: "an enabled generated upstream after a custom upstream",
		servers: [{ host: "cu_unused" }, { host: "one.example.com" }],
	},
	{
		name: "one enabled generated upstream among disabled generated and custom upstreams",
		servers: [
			{ host: "one.example.com", down: true },
			{ host: "cu_unused" },
			{ host: "two.example.com", down: false },
		],
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
		servers: [{ host: "one.example.com", down: true }],
	},
	{
		name: "a disabled generated upstream with a custom upstream",
		servers: [
			{ host: "one.example.com", down: true },
			{ host: "cu_unused" },
		],
	},
	{
		name: "multiple disabled generated upstreams with a custom upstream first",
		servers: [
			{ host: "cu_unused" },
			{ host: "one.example.com", down: true },
			{ host: "two.example.com", down: true },
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
		assertInvalid([{ host: "cu_primary", [field]: value }]);
	});
}
