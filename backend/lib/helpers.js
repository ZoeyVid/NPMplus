import dayjs from "dayjs";
import { ref } from "objection";
import { isPostgres } from "./config.js";

const datePeriodPattern = /^(?<amount>[0-9]+)(?<unit>y|Q|M|w|d|h|m|s|ms)$/mu;
const localDateTimePattern = /^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}$/u;

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
		return dayjs().add(matches.groups.amount, matches.groups.unit);
	}

	return null;
};

const convertIntFieldsToBool = (obj, fields) => {
	for (const field of fields) {
		if (obj[field] !== undefined) obj[field] = obj[field] === 1;
	}
	return obj;
};

const convertBoolFieldsToInt = (obj, fields) => {
	for (const field of fields) {
		if (obj[field] !== undefined) obj[field] = obj[field] ? 1 : 0;
	}
	return obj;
};

const certificateFields = [
	"npmplus_reuse_key",
	"npmplus_dns_challenge",
	"npmplus_dns_provider",
	"npmplus_dns_provider_credentials",
	"npmplus_propagation_seconds",
];

const pickCertificateFields = (obj) =>
	Object.fromEntries(Object.entries(obj).filter(([key]) => certificateFields.includes(key)));

const removeCertificateFields = (obj) =>
	Object.fromEntries(Object.entries(obj).filter(([key]) => !certificateFields.includes(key)));

const jsonReplacer = (key, value) => {
	if (typeof value !== "string") return value;
	if (key === "password") return "";
	if (
		[
			"certificate",
			"certificate_key",
			"dns_provider_credentials",
			"npmplus_dns_provider_credentials",
			"hint",
		].includes(key)
	) {
		return;
	}
	if (["created_on", "modified_on", "expires_on"].includes(key) && localDateTimePattern.test(value)) {
		return new Date(value.replace(" ", "T")).toISOString();
	}
	return value;
};

/**
 * Casts a column to json if using postgres
 *
 * @param {string} colName
 * @returns {string|Objection.ReferenceBuilder}
 */
const castJsonIfNeed = (colName) => (isPostgres() ? ref(colName).castText() : colName);

export {
	castJsonIfNeed,
	convertBoolFieldsToInt,
	convertIntFieldsToBool,
	jsonReplacer,
	parseDatePeriod,
	pickCertificateFields,
	removeCertificateFields,
};
