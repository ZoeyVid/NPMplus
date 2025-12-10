import { cleanup, render, screen } from "@testing-library/react";
import dayjs from "dayjs";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CertificateExpiryWidget } from "./CertificateExpiryWidget";

// Mock dependencies
const mockCertificates = [
	{
		id: 1,
		niceName: "Expiring Soon",
		domainNames: ["expiring.com"],
		expiresOn: dayjs().add(5, "day").toISOString(),
	},
	{
		id: 2,
		niceName: "Expired Cert",
		domainNames: ["expired.com"],
		expiresOn: dayjs().subtract(1, "day").toISOString(),
	},
	{
		id: 3,
		niceName: "Valid Long Term",
		domainNames: ["valid.com"],
		expiresOn: dayjs().add(60, "day").toISOString(),
	},
];

// Mock T component from src/locale
vi.mock("src/locale", () => ({
	T: ({ id, data }: { id: string; data?: any }) => {
		if (id === "dashboard.certificates-expiring") return "Certificates Expiring Soon";
		if (id === "dashboard.expired") return "Expired";
		if (id === "dashboard.days-left") return `${data?.days} Days Left`;
		if (id === "dashboard.no-expiring-certificates") return "No certificates expiring soon";
		return id;
	},
}));

vi.mock("src/components", () => ({
	HasPermission: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("CertificateExpiryWidget", () => {
	afterEach(() => {
		cleanup();
		vi.resetModules();
	});

	it("renders expiring and expired certificates", () => {
		vi.mock("src/hooks", () => ({
			useCertificates: () => ({
				data: mockCertificates,
			}),
		}));

		render(
			<MemoryRouter>
				<CertificateExpiryWidget />
			</MemoryRouter>,
		);

		// Check title
		expect(screen.getByText("Certificates Expiring Soon")).toBeInTheDocument();

		// Check expiring certificate
		expect(screen.getByText("Expiring Soon")).toBeInTheDocument();
		expect(screen.getByText(/Days Left/)).toBeInTheDocument();

		// Check expired certificate
		expect(screen.getByText("Expired Cert")).toBeInTheDocument();
		expect(screen.getByText("Expired")).toBeInTheDocument();

		// Check that valid certificate is NOT displayed
		expect(screen.queryByText("Valid Long Term")).not.toBeInTheDocument();

		// Check link to certificates page
		const links = screen.getAllByRole("link");
		expect(links.length).toBeGreaterThan(0);
		expect(links[0]).toHaveAttribute("href", "/certificates");
	});

	it("renders empty state when no certificates are expiring", async () => {
		// Re-mock hook for this test
		vi.doMock("src/hooks", () => ({
			useCertificates: () => ({
				data: [
					{
						id: 3,
						niceName: "Valid Long Term",
						domainNames: ["valid.com"],
						expiresOn: dayjs().add(60, "day").toISOString(),
					},
				],
			}),
		}));

		// We need to re-import the component to pick up the new mock because of how ESM modules work in Vite/Vitest
		const { CertificateExpiryWidget: Widget } = await import("./CertificateExpiryWidget");

		render(
			<MemoryRouter>
				<Widget />
			</MemoryRouter>,
		);

		// screen should be clean now, but if previous test failed to cleanup, getByText might find multiple.
		// cleanup() in afterEach should handle this.
		expect(screen.getByText("Certificates Expiring Soon")).toBeInTheDocument();
		expect(screen.getByText("No certificates expiring soon")).toBeInTheDocument();
		expect(screen.queryByText("Valid Long Term")).not.toBeInTheDocument();
	});
});
