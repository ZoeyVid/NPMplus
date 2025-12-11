import { afterEach, describe, expect, it, vi } from "vitest";
import { isDestructiveTestMode } from "../lib/config.js";

describe("isDestructiveTestMode", () => {
	const originalEnv = process.env;

	afterEach(() => {
		process.env = originalEnv;
		vi.resetModules();
	});

	it("should return false by default", () => {
		process.env = { ...originalEnv };
		delete process.env.CI;
		delete process.env.NPM_CI_ENABLE_DESTRUCTIVE_TEST_MODE;
		expect(isDestructiveTestMode()).toBe(false);
	});

	it("should return false if only CI is true", () => {
		process.env = { ...originalEnv, CI: "true" };
		delete process.env.NPM_CI_ENABLE_DESTRUCTIVE_TEST_MODE;
		expect(isDestructiveTestMode()).toBe(false);
	});

	it("should return false if only NPM_CI_ENABLE_DESTRUCTIVE_TEST_MODE is true", () => {
		process.env = { ...originalEnv, NPM_CI_ENABLE_DESTRUCTIVE_TEST_MODE: "true" };
		delete process.env.CI;
		expect(isDestructiveTestMode()).toBe(false);
	});

	it("should return true if both CI and NPM_CI_ENABLE_DESTRUCTIVE_TEST_MODE are true", () => {
		process.env = {
			...originalEnv,
			CI: "true",
			NPM_CI_ENABLE_DESTRUCTIVE_TEST_MODE: "true",
		};
		expect(isDestructiveTestMode()).toBe(true);
	});

	it("should return false if values are not exactly 'true'", () => {
		process.env = {
			...originalEnv,
			CI: "1",
			NPM_CI_ENABLE_DESTRUCTIVE_TEST_MODE: "yes",
		};
		expect(isDestructiveTestMode()).toBe(false);
	});
});
