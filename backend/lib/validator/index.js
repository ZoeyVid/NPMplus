import Ajv from "ajv/dist/2020.js";
import commonDefinitions from "../../schema/common.json" with { type: "json" };
import errs from "../error.js";

RegExp.prototype.toJSON = RegExp.prototype.toString;

const ajv = new Ajv({
	verbose: true,
	allErrors: true,
	allowUnionTypes: true,
	coerceTypes: true,
	strict: false,
	schemas: [commonDefinitions],
});

/**
 *
 * @param   {Object} schema
 * @param   {Object} payload
 * @returns {Object}
 */
const validator = (schema, payload) => {
	const validate = ajv.compile(schema);
	if (validate(payload)) return structuredClone(payload);

	throw new errs.ValidationError(ajv.errorsText(validate.errors));
};

export default validator;
