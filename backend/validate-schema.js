#!/usr/bin/env node

import SwaggerParser from "@apidevtools/swagger-parser";
import { getCompiledSchema } from "./schema/index.js";

try {
	const api = await SwaggerParser.validate(await getCompiledSchema());
	console.log("API name: %s, Version: %s", api.info.title, api.info.version);
	console.log("❯ Schema is valid");
} catch (e) {
	console.error(e);
	console.log("❯", e.message, "\n");
	process.exit(1);
}
