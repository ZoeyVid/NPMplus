import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { LocationsFields, createUiLocation } from "../frontend/src/components/Form/LocationsFields";
import { Button } from "../frontend/src/components/Button";
import { showProxyHostModal } from "../frontend/src/modals/ProxyHostModal";

const state = vi.hoisted(() => ({
	data: null,
	submit: vi.fn(),
	modal: null,
}));

// Keep the real modal, Formik, location editor and upstream editor. Only mock
// external data, modal orchestration and unrelated form widgets.
vi.mock("src/hooks", () => ({
	useProxyHost: () => ({ data: state.data, isPending: false }),
	useProxyHosts: () => ({ data: [] }),
	useDirectorySuggestions: () => [],
	useSetProxyHost: () => ({ mutateAsync: state.submit }),
	useUser: () => ({ data: { npmplusIsAdmin: true } }),
}));
vi.mock("src/locale", () => ({
	intl: { formatMessage: ({ id }) => id },
	T: ({ id }) => id,
}));
vi.mock("src/notifications", () => ({ showObjectSuccess: vi.fn() }));
vi.mock("src/modules/easyModal", () => ({
	default: {
		create: (Component) => Component,
		show: (Component, props) => { state.modal = { Component, props }; },
	},
}));
vi.mock("src/components", () => ({
	get LocationsFields() { return LocationsFields; },
	get createUiLocation() { return createUiLocation; },
	get Button() { return Button; },
	AccessFields: () => null,
	CommandOutput: () => null,
	DirectoryField: () => null,
	DomainNamesField: () => null,
	Loading: () => null,
	NginxConfigField: () => null,
	SSLCertificateField: () => null,
	SSLOptionsFields: () => null,
}));

export const server = (host, port = null) => ({ host, port, custom: false, backup: false, down: false });

export const savedLocation = () => ({
	id: 123,
	proxyHostId: 42,
	path: "/app/",
	forwardScheme: "http",
	npmplusForwardPath: "/backend/",
	npmplusLoadBalanceMethod: "least_conn",
	npmplusUpstreamServers: [server("one.example.com", 8080), server("two.example.com")],
	accessLists: [],
});

export function openProxyHost(locations = [], id = 42, overrides = {}) {
	state.data = {
		domainNames: ["proxy.example.com"],
		forwardScheme: "http",
		npmplusUpstreamServers: [server("root.example.com", 80)],
		accessLists: [],
		locations,
		certificateId: 0,
		sslForced: false,
		hstsEnabled: false,
		hstsSubdomains: false,
		advancedConfig: "",
		npmplusLocationConfig: "",
		npmplusDirectory: "",
		npmplusMtlsCertificateId: 0,
		npmplusMtlsVerifyClientOptional: false,
		npmplusMtlsBypassAuthRequest: false,
		npmplusHttp3Support: false,
		npmplusNoindex: false,
		npmplusDisableCrowdsecAppsec: false,
		npmplusProxyResponseBuffering: "on_auto",
		npmplusDisableProxyRequestBuffering: false,
		npmplusUpstreamCompression: false,
		npmplusFancyindex: false,
		npmplusXFrameOptions: "SAMEORIGIN",
		npmplusAuthRequest: "none",
		npmplusAuthRequestUpstream: "",
		npmplusAccessListType: "public",
		...overrides,
	};
	state.submit.mockReset().mockResolvedValue({});
	showProxyHostModal(id, false);
	const { Component, props } = state.modal;
	render(<Component {...props} visible remove={vi.fn()} close={vi.fn()} />);
	return document.querySelector("#tab-locations");
}

export function locationField(name) {
	const element = document.querySelector(`#tab-locations [name="${name}"]`);
	if (!element) throw new Error(`Missing location field: ${name}`);
	return element;
}

export function expandLocation() {
	fireEvent.click(screen.getByRole("button", { name: /^\/app\// }));
}

export async function submitProxyHost() {
	fireEvent.submit(document.querySelector('[role="dialog"] form'));
	await waitFor(() => {
		if (state.submit.mock.calls.length !== 1) throw new Error("Expected one proxy host submission");
	});
	return state.submit.mock.calls[0][0];
}
