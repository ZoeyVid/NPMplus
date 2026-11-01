#!/usr/bin/env node

import { Validator } from "@seriousme/openapi-schema-validator";
import { compiledSchema as api } from "./schema/index.js";

const { valid, errors } = await new Validator().validate(api);

if (!valid) {
	console.error(errors);
	console.log("❯ Schema is invalid\n");
	process.exit(1);
}

console.log("API name: %s, Version: %s", api.info.title, api.info.version);
console.log("❯ Schema is valid");
