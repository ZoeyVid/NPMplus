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

const getQuerystringContent = (path, method) =>
	compiledSchema.paths[path]?.[method]?.parameters?.find((parameter) => parameter.in === "querystring")?.content[
		"application/x-www-form-urlencoded"
	] ?? null;

const getPathParameters = (path, method) => {
	const operation = compiledSchema.paths[path]?.[method];
	return operation ? (operation.parameters ?? []).filter((parameter) => parameter.in === "path") : null;
};

export { compiledSchema, getPathParameters, getQuerystringContent, getValidationSchema };
