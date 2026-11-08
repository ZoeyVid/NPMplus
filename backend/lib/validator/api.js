import Ajv from "ajv/dist/2020.js";
import errs from "../error.js";

const ajv = new Ajv({
	verbose: true,
	allowUnionTypes: true,
	strict: false,
	coerceTypes: true,
});

const untrimmedPaths = new Set([
	"/secret",
	"/current",
	"/auth/secret",
	"/items/password",
	"/npmplus_dns_provider_credentials",
	"/advanced_config",
	"/npmplus_advanced_config",
	"/npmplus_location_config",
	"/locations/advanced_config",
	"/meta/html",
]);

const trimStrings = (value, path = "", depth = 0) => {
	if (depth > 8) throw new errs.ValidationError("Payload is nested too deeply");
	if (typeof value === "string") return untrimmedPaths.has(path) ? value : value.trim();
	if (Array.isArray(value)) return value.map((item) => trimStrings(item, path, depth + 1));
	if (value === null || typeof value !== "object") return value;
	return Object.fromEntries(
		Object.entries(value).map(([key, item]) => [key, trimStrings(item, `${path}/${key}`, depth + 1)]),
	);
};

/**
 * @param {Object} schema
 * @param {Object} payload
 * @param {string} [dataVar]
 * @returns {Promise}
 */
const apiValidator = (schema, payload, dataVar /*, description*/) => {
	if (!schema) {
		throw new errs.ValidationError("Schema is undefined");
	}

	// Can't use falsy check here as valid payload could be `0` or `false`
	if (payload === undefined) throw new errs.ValidationError("Payload is undefined");

	const validate = ajv.compile(schema);

	const data = trimStrings(payload);

	if (validate(data)) return data;

	const message = ajv.errorsText(validate.errors, { dataVar });
	const err = new errs.ValidationError(message);
	err.debug = { validationErrors: validate.errors, payload };
	throw err;
};

export default apiValidator;
