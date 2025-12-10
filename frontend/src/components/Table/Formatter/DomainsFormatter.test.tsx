import { cleanup, render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it } from "vitest";
import { DomainsFormatter } from "./DomainsFormatter";
import "@testing-library/jest-dom/vitest";
import enMessages from "src/locale/lang/en.json";

// Mock IntlProvider with actual messages
const Wrapper = ({ children }: { children: React.ReactNode }) => (
	<IntlProvider locale="en" messages={enMessages}>
		{children}
	</IntlProvider>
);

describe("DomainsFormatter", () => {
	afterEach(() => {
		cleanup();
	});

	it("renders domains as links", () => {
		render(
			<Wrapper>
				<DomainsFormatter domains={["example.com"]} />
			</Wrapper>,
		);
		const link = screen.getByText("example.com");
		expect(link).toBeInTheDocument();
		expect(link).toHaveAttribute("href", "http://example.com");
	});

	it("renders multiple domains", () => {
		render(
			<Wrapper>
				<DomainsFormatter domains={["example.com", "test.com"]} />
			</Wrapper>,
		);
		expect(screen.getByText("example.com")).toBeInTheDocument();
		expect(screen.getByText("test.com")).toBeInTheDocument();
	});
});
