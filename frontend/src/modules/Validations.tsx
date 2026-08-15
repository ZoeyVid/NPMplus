import type { InvalidEvent } from "react";
import { intl } from "src/locale";

const emailPattern = /@/;
const domainPattern = /^(?!.*:[0-9]+$).+$/;
const ipv4Pattern = /^[0-9.]+$/;
const upstreamUrlPattern = /^https?:\/\/([^/:]+|\[[a-fA-F0-9:]+\]):[0-9]+$/;

const validateString = (minLength = 0, maxLength = 0) => {
	if (minLength <= 0 && maxLength <= 0) {
		// this doesn't require translation
		console.error("validateString() must be called with a min or max or both values in order to work!");
	}

	return (value: string): string | undefined => {
		if (minLength && (typeof value === "undefined" || value.length === 0)) {
			return intl.formatMessage({ id: "error.required" });
		}
		if (minLength && value.length < minLength) {
			return intl.formatMessage({ id: "error.min-character-length" }, { min: minLength });
		}
		if (maxLength && (typeof value === "undefined" || value.length > maxLength)) {
			return intl.formatMessage({ id: "error.max-character-length" }, { max: maxLength });
		}
	};
};

const validateNumber = (min = -1, max = -1) => {
	if (min === -1 && max === -1) {
		// this doesn't require translation
		console.error("validateNumber() must be called with a min or max or both values in order to work!");
	}

	return (value: string): string | undefined => {
		const int: number = Number(value);
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
};

const validateEmail =
	() =>
	(value: string): string | undefined => {
		if (value.length === 0) {
			return intl.formatMessage({ id: "error.required" });
		}
		if (!emailPattern.test(value)) {
			return intl.formatMessage({ id: "error.invalid-email" });
		}
	};

const validateDomain = (allowWildcards = false) => {
	return (d: string): boolean => {
		const dom = d.trim().toLowerCase();

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

const validateDomains = (allowWildcards = false, maxDomains?: number) => {
	const vDom = validateDomain(allowWildcards);

	return (value?: string[]): string | undefined => {
		if (!value?.length) {
			return intl.formatMessage({ id: "error.required" });
		}

		// Deny if the list of domains is hit
		if (maxDomains && value?.length >= maxDomains) {
			return intl.formatMessage({ id: "error.max-domains" }, { max: maxDomains });
		}

		// validate each domain
		for (const domain of value ?? []) {
			if (!vDom(domain)) {
				return intl.formatMessage({ id: "error.invalid-domain" }, { domain });
			}
		}
	};
};

const showTabOfInvalid = ({ currentTarget }: InvalidEvent<HTMLFormElement>) => {
	const field = currentTarget.querySelector(":invalid");
	const pane = field?.closest(".tab-pane:not(.active)");
	if (pane) currentTarget.querySelector<HTMLElement>(`[data-bs-toggle="tab"][href="#${pane.id}"]`)?.click();
	field?.scrollIntoView({ block: "center" });
};

const validateUpstreamUrl =
	() =>
	(value: string): string | undefined => {
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
