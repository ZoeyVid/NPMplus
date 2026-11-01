import $RefParser from "@apidevtools/json-schema-ref-parser";
import PACKAGE from "../package.json" with { type: "json" };

/**
 * Compiles the schema, by dereferencing it, only once
 * and returns the memory cached value
 */
const compiledSchema = await $RefParser.dereference(`${import.meta.dirname}/swagger.json`, {
	mutateInputSchema: false,
});
compiledSchema.info.version = PACKAGE.version;

/**
 * Scans the schema for the validation schema for the given path and method
 * and returns it.
 *
 * @param {string} path
 * @param {string} method
 * @returns string|null
 */
const getValidationSchema = (path, method) =>
	compiledSchema.paths[path]?.[method]?.requestBody?.content?.["application/json"]?.schema ?? null;

const getRequestBody = (path, method) => compiledSchema.paths[path]?.[method]?.requestBody ?? null;

const getQueryParameters = (path, method) =>
	compiledSchema.paths[path]?.[method]?.parameters?.filter((parameter) => parameter.in === "query") ?? [];

const querySchemas = {};

const getQuerySchema = (path, method) => {
	const key = `${method} ${path}`;
	if (querySchemas[key]) return querySchemas[key];
	querySchemas[key] = { type: "object", additionalProperties: false, properties: {}, required: [] };
	for (const { name, schema, required } of getQueryParameters(path, method)) {
		querySchemas[key].properties[name] = schema;
		if (required) querySchemas[key].required.push(name);
	}
	return querySchemas[key];
};

const getPathParameters = (path, method) => {
	const operation = compiledSchema.paths[path]?.[method];
	return operation ? (operation.parameters ?? []).filter((parameter) => parameter.in === "path") : null;
};

export { compiledSchema, getPathParameters, getQueryParameters, getQuerySchema, getRequestBody, getValidationSchema };
