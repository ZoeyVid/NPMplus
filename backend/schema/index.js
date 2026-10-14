import $RefParser from "@apidevtools/json-schema-ref-parser";

let compiledSchema = null;

/**
 * Compiles the schema, by dereferencing it, only once
 * and returns the memory cached value
 */
const getCompiledSchema = async () => {
	compiledSchema ??= await $RefParser.dereference(`${import.meta.dirname}/swagger.json`, {
		mutateInputSchema: false,
	});
	return compiledSchema;
};

/**
 * Scans the schema for the validation schema for the given path and method
 * and returns it.
 *
 * @param {string} path
 * @param {string} method
 * @returns string|null
 */
const getValidationSchema = (path, method) =>
	compiledSchema?.paths[path]?.[method]?.requestBody?.content?.["application/json"]?.schema ?? null;

export { getCompiledSchema, getValidationSchema };
