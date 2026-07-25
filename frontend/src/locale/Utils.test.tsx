import { formatDateTime, getFlagCodeForLocale } from "src/locale/Utils";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("DateFormatter", () => {
	// Keep a reference to the real Intl to restore later
	const RealIntl = globalThis.Intl;
	const desiredTimeZone = "Europe/London";
	const desiredLocale = "en-GB";

	beforeAll(() => {
		// Mock Intl.DateTimeFormat so formatting is stable regardless of host
		const MockedDateTimeFormat = class extends RealIntl.DateTimeFormat {
			constructor(_locales?: string | string[], options?: Intl.DateTimeFormatOptions) {
				super(desiredLocale, {
					...options,
					timeZone: desiredTimeZone,
				});
			}
		} as unknown as typeof Intl.DateTimeFormat;

		globalThis.Intl = {
			...RealIntl,
			DateTimeFormat: MockedDateTimeFormat,
		};
	});

	afterAll(() => {
		// Restore original Intl after tests
		globalThis.Intl = RealIntl;
	});

	it("format date from iso date", () => {
		const value = "2024-01-01T00:00:00.000Z";
		const text = formatDateTime(value);
		expect(text).toBe("1 Jan 2024, 00:00:00");
	});

	it("format date from unix timestamp number", () => {
		const value = 1762476112;
		const text = formatDateTime(value);
		expect(text).toBe("7 Nov 2025, 00:41:52");
	});

	it("format date from unix timestamp string", () => {
		const value = "1762476112";
		const text = formatDateTime(value);
		expect(text).toBe("7 Nov 2025, 00:41:52");
	});

	it("catch bad format from string", () => {
		const value = "this is not a good date";
		const text = formatDateTime(value);
		expect(text).toBe("this is not a good date");
	});

	it("catch bad format from number", () => {
		const value = -100;
		const text = formatDateTime(value);
		expect(text).toBe("-100");
	});

	it("catch bad format from number as string", () => {
		const value = "-100";
		const text = formatDateTime(value);
		expect(text).toBe("-100");
	});
});

describe("getFlagCodeForLocale", () => {
	it("returns correct flag code for standard locales", () => {
		expect(getFlagCodeForLocale("en-US")).toBe("EN");
		expect(getFlagCodeForLocale("de-DE")).toBe("DE");
		expect(getFlagCodeForLocale("fr-FR")).toBe("FR");
	});

	it("returns correct flag code for special-case locales", () => {
		expect(getFlagCodeForLocale("ja-JP")).toBe("JP");
		expect(getFlagCodeForLocale("zh-CN")).toBe("CN");
		expect(getFlagCodeForLocale("vi-VN")).toBe("VN");
		expect(getFlagCodeForLocale("ko-KR")).toBe("KR");
		expect(getFlagCodeForLocale("cs-CZ")).toBe("CZ");
	});

	it("returns IE (Ireland) for Irish locale, not GA (Gabon)", () => {
		expect(getFlagCodeForLocale("ga-IE")).toBe("IE");
	});

	it("falls back to EN when no locale is provided", () => {
		expect(getFlagCodeForLocale()).toBe("EN");
		expect(getFlagCodeForLocale(undefined)).toBe("EN");
	});
});
