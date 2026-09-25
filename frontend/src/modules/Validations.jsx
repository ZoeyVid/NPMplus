import { intl } from "src/locale";

const emailPattern = /@/;
const domainPattern = /^(?!.*:[0-9]+$).+$/;
const ipv4Pattern = /^[0-9.]+$/;
const upstreamUrlPattern = /^https?:\/\/(([^\s/:]+|\[[a-fA-F0-9:]+\]):[0-9]+|cu_[^\s/:]+)$/;

const validateString =
	(minLength = 0, maxLength = 0) =>
	(value) => {
		if (minLength && value.length === 0) {
			return intl.formatMessage({ id: "error.required" });
		}
		if (value.length < minLength) {
			return intl.formatMessage({ id: "error.min-character-length" }, { min: minLength });
		}
		if (maxLength && value.length > maxLength) {
			return intl.formatMessage({ id: "error.max-character-length" }, { max: maxLength });
		}
	};

const validateNumber = (min = -1, max = -1, allowZero = false) => {
	if (min === -1 && max === -1) {
		// this doesn't require translation
		console.error("validateNumber() must be called with a min or max or both values in order to work!");
	}

	return (value) => {
		const int = Number(value);
		if (min > -1 && !int && !(allowZero && int === 0)) {
			return intl.formatMessage({ id: "error.required" });
		}
		if (min > -1 && int < min) {
			return intl.formatMessage({ id: "error.minimum" }, { min });
		}
		if (max > -1 && int > max) {
			return intl.formatMessage({ id: "error.maximum" }, { max });
		}
	};

const validateEmail = () => (value) => {
	if (value.length === 0) {
		return intl.formatMessage({ id: "error.required" });
	}
	if (!emailPattern.test(value)) {
		return intl.formatMessage({ id: "error.invalid-email" });
	}
};

const validateDomain = (allowWildcards) => {
	return (d) => {
		const dom = d.trim();

		if (!allowWildcards) {
			// Block wildcards
			if (dom.includes("*")) {
				return false;
			}
		} else {
			// Block IPv6
			if (dom.startsWith("[") && dom.endsWith("]")) {
				return false;
			}

			// Block IPv4
			if (ipv4Pattern.test(dom)) {
				return false;
			}
		}

		// This will match *.com type domains,
		return domainPattern.test(dom);
	};
};

const validateDomains = (allowWildcards) => {
	const vDom = validateDomain(allowWildcards);

	return (value) => {
		if (!value?.length) {
			return intl.formatMessage({ id: "error.required" });
		}

		// validate each domain
		for (const domain of value) {
			if (!vDom(domain)) {
				return intl.formatMessage({ id: "error.invalid-domain" }, { domain });
			}
		}
	};
};

const showTabOfInvalid = ({ currentTarget }) => {
	const field = currentTarget.querySelector(":invalid");
	const pane = field?.closest(".tab-pane:not(.active)");
	if (pane) currentTarget.querySelector(`[data-bs-toggle="tab"][href="#${pane.id}"]`)?.click();
	field?.scrollIntoView({ block: "center" });
};

const validateUpstreamUrl = () => (value) => {
	if (value && !upstreamUrlPattern.test(value)) {
		return intl.formatMessage({ id: "error.invalid-upstream-url" });
	}
};

export {
	showTabOfInvalid,
	upstreamUrlPattern,
	validateDomain,
	validateDomains,
	validateEmail,
	validateNumber,
	validateString,
	validateUpstreamUrl,
};
