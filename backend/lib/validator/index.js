import Ajv from "ajv/dist/2020.js";
import _ from "lodash";
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
 * @returns {Promise<Object>}
 */
const validator = async (schema, payload) => {
	if (!payload) {
		throw new errs.InternalValidationError("Payload is falsy");
	}

	try {
		const validate = ajv.compile(schema);
		const valid = validate(payload);

		if (valid && !validate.errors) {
			return _.cloneDeep(payload);
		}

		const message = ajv.errorsText(validate.errors);
		throw new errs.InternalValidationError(message);
	} catch (err) {
		throw err;
	}
};

export default validator;