import { ref } from "objection";
import { isPostgres } from "./config.js";

const localDateTimePattern = /^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}$/u;

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
		return new Date(`${value.replace(" ", "T")}Z`).toISOString();
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
	pickCertificateFields,
	removeCertificateFields,
};
