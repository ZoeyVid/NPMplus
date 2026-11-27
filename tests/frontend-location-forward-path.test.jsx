import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { expandLocation, locationField, openProxyHost, savedLocation, submitProxyHost } from "./proxy-host-test-utils";

afterEach(cleanup);

test("reopening a custom location restores its forward path and preserves it across collapse and expand", () => {
	openProxyHost([savedLocation()]);
	expandLocation();
	expect(locationField("locations[0].npmplusForwardPath").value).toBe("/backend/");
	expandLocation();
	expandLocation();
	expect(locationField("locations[0].npmplusForwardPath").value).toBe("/backend/");
});

test("editing an upstream weight in a reopened location preserves the saved forward path in the submitted payload", async () => {
	openProxyHost([savedLocation()]);
	expandLocation();
	fireEvent.change(locationField("locations[0].npmplusUpstreamServers[0].weight"), { target: { value: "2" } });
	const payload = await submitProxyHost();
	expect(payload.locations[0].npmplusForwardPath).toBe("/backend/");
	expect(payload.locations[0].npmplusUpstreamServers[0].weight).toBe(2);
});
