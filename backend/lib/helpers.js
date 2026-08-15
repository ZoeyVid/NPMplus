import dayjs from "dayjs";
import { ref } from "objection";
import { isPostgres } from "./config.js";

const datePeriodPattern = /^([0-9]+)(y|Q|M|w|d|h|m|s|ms)$/m;

/**
 * Takes an expression such as 30d and returns a dayjs object of that date in future
 *
 * Key      Shorthand
 * ==================
 * years         y
 * quarters      Q
 * months        M
 * weeks         w
 * days          d
 * hours         h
 * minutes       m
 * seconds       s
 * milliseconds  ms
 *
 * @param {String}  expression
 * @returns {Object}
 */
const parseDatePeriod = (expression) => {
	const matches = expression.match(datePeriodPattern);
	if (matches) {
		return dayjs().add(matches[1], matches[2]);
	}

	return null;
};

const convertIntFieldsToBool = (obj, fields) => {
	for (const field of fields) {
		if (typeof obj[field] !== "undefined") {
			obj[field] = obj[field] === 1;
		}
	}
	return obj;
};

const convertBoolFieldsToInt = (obj, fields) => {
	for (const field of fields) {
		if (typeof obj[field] !== "undefined") {
			obj[field] = obj[field] ? 1 : 0;
		}
	}
	return obj;
};

/**
 * Casts a column to json if using postgres
 *
 * @param {string} colName
 * @returns {string|Objection.ReferenceBuilder}
 */
const castJsonIfNeed = (colName) => (isPostgres() ? ref(colName).castText() : colName);

export { castJsonIfNeed, convertBoolFieldsToInt, convertIntFieldsToBool, parseDatePeriod };
