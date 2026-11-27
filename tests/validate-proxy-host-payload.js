// Run in Node, not jsdom: the schema dereferencer uses different resolvers
// when browser globals are present.
import { readFileSync } from "node:fs";
import apiValidator from "../backend/lib/validator/api.js";
import { getValidationSchema } from "../backend/schema/index.js";

const { id, body } = JSON.parse(readFileSync(0, "utf8"));
const schema = id
	? getValidationSchema("/nginx/proxy-hosts/{host_id}", "put")
	: getValidationSchema("/nginx/proxy-hosts", "post");
process.stdout.write(JSON.stringify(apiValidator(schema, body)));
