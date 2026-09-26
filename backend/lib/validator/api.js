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
	"/items/username",
	"/items/password",
	"/npmplus_dns_provider_credentials",
	"/advanced_config",
	"/npmplus_advanced_config",
	"/npmplus_location_config",
	"/locations/advanced_config",
	"/locations/location_type",
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
 * @returns {Promise}
 */
const apiValidator = (schema, payload /*, description*/) => {
	if (!schema) {
		throw new errs.ValidationError("Schema is undefined");
	}

	// Can't use falsy check here as valid payload could be `0` or `false`
	if (typeof payload === "undefined") {
		throw new errs.ValidationError("Payload is undefined");
	}

	const validate = ajv.compile(schema);

	const data = trimStrings(payload);
	const valid = validate(data);

	if (valid && !validate.errors) {
		return data;
	}

	const message = ajv.errorsText(validate.errors);
	const err = new errs.ValidationError(message);
	err.debug = { validationErrors: validate.errors, payload };
	throw err;
};

export default apiValidator;
