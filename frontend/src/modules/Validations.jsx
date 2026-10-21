import { intl } from "src/locale";

const emailPattern = /@/u;
const domainPattern = /^(?:~\S{0,252}|(?!.*:[0-9]+$)[^\s/]{1,253})$/u;
const certificateHttpDomainPattern =
	/^(?:(?:[\p{L}\p{Mn}\p{Mc}\p{Nd}-]+\.)+[\p{L}\p{Mn}\p{Mc}\p{Nd}-]+|\[[0-9a-fA-F:]+\])$/u;
const certificateDnsDomainPattern =
	/^(?![0-9.]+$)(?:\*\.)?(?:[\p{L}\p{Mn}\p{Mc}\p{Nd}-]+\.)+[\p{L}\p{Mn}\p{Mc}\p{Nd}-]+$/u;
const upstreamUrlPattern = /^https?:\/\/(?:(?:[^\s/:]+|\[[a-fA-F0-9:]+\]):[0-9]+|cu_[^\s/:]+)$/u;

const validateString =
	(minLength = 0, maxLength = 0, trim = true) =>
	(value) => {
		const { length } = trim ? value.trim() : value;
		if (minLength && length === 0) {
			return intl.formatMessage({ id: "error.required" });
		}
		if (length < minLength) {
			return intl.formatMessage({ id: "error.min-character-length" }, { min: minLength });
		}
		if (maxLength && length > maxLength) {
			return intl.formatMessage({ id: "error.max-character-length" }, { max: maxLength });
		}
	};

const validateNumber =
	(min = -1, max = -1) =>
	(value) => {
		const int = Number(value);
		if (min > -1 && !int) {
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
	if (value.length > 255) {
		return intl.formatMessage({ id: "error.max-character-length" }, { max: 255 });
	}
};

const validateDomain = (allowWildcards, forCertificate) => (input) => {
	const domain = input.trim();
	if (!forCertificate) return domainPattern.test(domain);
	return (
		[...domain].length <= 253 &&
		(allowWildcards ? certificateDnsDomainPattern : certificateHttpDomainPattern).test(domain)
	);
};

const validateDomains = (allowWildcards, forCertificate) => {
	const vDom = validateDomain(allowWildcards, forCertificate);
	const maxDomains = forCertificate ? 25 : 100;

	return (value) => {
		if (!value?.length) {
			return intl.formatMessage({ id: "error.required" });
		}

		if (value.length > maxDomains) {
			return intl.formatMessage({ id: "error.max-domains" }, { max: maxDomains });
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
