import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { decamelizeKeys } from "../frontend/src/api/backend/caseConvert";
import { openProxyHost, locationField, savedLocation, submitProxyHost } from "./proxy-host-test-utils";

beforeEach(() => {
	vi.stubGlobal("scrollTo", () => {});
	Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

function validatePayload(payload) {
	const { id, ...body } = payload;
	const serialized = JSON.parse(JSON.stringify(decamelizeKeys(body)));
	return JSON.parse(execFileSync(process.execPath, [resolve("tests/validate-proxy-host-payload.js")], {
		input: JSON.stringify({ id, body: serialized }),
		encoding: "utf8",
	}));
}

function assertLocationPayload(payload) {
	const location = JSON.parse(JSON.stringify(decamelizeKeys(payload))).locations[0];
	for (const key of ["id", "proxy_host_id", "ui_key", "access_lists"]) {
		expect(location).not.toHaveProperty(key);
	}
	expect(location.path).toBe("/app/");
	expect(location.npmplus_forward_path).toBe("/backend/");
	expect(location.npmplus_upstream_servers).toHaveLength(2);
	const validated = validatePayload(payload);
	expect(validated.locations[0].npmplus_forward_path).toBe("/backend/");
	return location;
}

test("new custom location submits multiple upstreams without UI or database identifiers", async () => {
	const tab = openProxyHost([], "new");
	fireEvent.click(screen.getByRole("button", { name: "action.add-location" }));
	fireEvent.change(locationField("locations.0.path"), { target: { value: "/app/" } });
	fireEvent.change(locationField("locations[0].npmplusForwardPath"), { target: { value: "/backend/" } });
	fireEvent.change(locationField("locations[0].npmplusUpstreamServers[0].host"), { target: { value: "one.example.com" } });
	fireEvent.change(locationField("locations[0].npmplusUpstreamServers[0].port"), { target: { value: "8080" } });
	fireEvent.click(within(tab).getByRole("button", { name: "action.add" }));
	fireEvent.change(locationField("locations[0].npmplusUpstreamServers[1].host"), { target: { value: "two.example.com" } });
	const payload = await submitProxyHost();
	assertLocationPayload(payload);
});

test("existing custom location submits without UI or database identifiers", async () => {
	openProxyHost([savedLocation()]);
	const payload = await submitProxyHost();
	expect(assertLocationPayload(payload).npmplus_load_balance_method).toBe("least_conn");
});

test.each(["grpc", "grpcs"])("saving an existing %s proxy host sends a valid null forward path", async (scheme) => {
	openProxyHost([], 42, { forwardScheme: scheme });
	const payload = await submitProxyHost();
	expect(payload.npmplusForwardPath).toBeNull();
	const validated = validatePayload(payload);
	expect(validated.forward_scheme).toBe(scheme);
	expect(validated.npmplus_forward_path).toBeNull();
});

test.each(["grpc", "grpcs", "path", "empty", "http"])("scheme transition through grpcs to %s submits valid buffering properties", async (scheme) => {
	openProxyHost([], 42, {
		npmplusForwardPath: "/backend/",
		npmplusDisableCrowdsecAppsec: true,
		npmplusDisableProxyRequestBuffering: true,
		npmplusProxyResponseBuffering: "off_forced",
	});
	const field = document.querySelector('[name="forwardScheme"]');
	fireEvent.change(field, { target: { value: "grpcs" } });
	if (scheme !== "grpcs") {
		fireEvent.change(field, { target: { value: scheme } });
	}
	if (scheme === "path") {
		fireEvent.change(document.querySelector('[name="npmplusUpstreamServers[0].host"]'), { target: { value: "/tmp/test" } });
		fireEvent.change(document.querySelector('[name="npmplusUpstreamServers[0].port"]'), { target: { value: "" } });
	}
	const payload = await submitProxyHost();
	if (scheme === "empty") {
		expect(payload.npmplusUpstreamServers[0]).toMatchObject({ host: "root.example.com", port: 80 });
	}
	expect(payload).not.toHaveProperty("npmplusProxyRequestBuffering");
	expect(payload.npmplusDisableProxyRequestBuffering).toBe(false);
	expect(payload.npmplusProxyResponseBuffering).toBe("on_auto");
	expect(validatePayload(payload).forward_scheme).toBe(scheme);
});

test("custom location scheme transition resets incompatible buffering settings", async () => {
	openProxyHost([{
		...savedLocation(),
		npmplusDisableCrowdsecAppsec: true,
		npmplusDisableProxyRequestBuffering: true,
		npmplusProxyResponseBuffering: "off_forced",
	}]);
	fireEvent.click(screen.getByRole("button", { name: /^\/app\// }));
	fireEvent.change(locationField("locations[0].forwardScheme"), { target: { value: "grpcs" } });
	const payload = await submitProxyHost();
	expect(payload.locations[0]).not.toHaveProperty("npmplusProxyRequestBuffering");
	expect(payload.locations[0].npmplusDisableProxyRequestBuffering).toBe(false);
	expect(payload.locations[0].npmplusProxyResponseBuffering).toBe("on_auto");
	expect(validatePayload(payload).locations[0].forward_scheme).toBe("grpcs");
});

