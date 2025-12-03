import { render, screen } from "@testing-library/react";
import dayjs from "dayjs";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

// Mock the dependencies
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

vi.mock("src/hooks", () => ({
	useCertificates: () => ({
		data: mockCertificates,
	}),
}));

vi.mock("src/components", () => ({
	HasPermission: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock T component from src/locale
vi.mock("src/locale", () => ({
	T: ({ id, data }: { id: string; data?: any }) => {
		if (id === "dashboard.certificates-expiring") return "Certificates Expiring Soon";
		if (id === "dashboard.expired") return "Expired";
		if (id === "dashboard.days-left") return `${data.days} Days Left`;
		return id;
	},
}));

import { CertificateExpiryWidget } from "./CertificateExpiryWidget";

describe("CertificateExpiryWidget", () => {
	it("renders expiring and expired certificates", () => {
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
	});
});
