import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { DomainsFormatter } from "./DomainsFormatter";
import { IntlProvider } from "react-intl";
import "@testing-library/jest-dom/vitest";

// Mock IntlProvider
const Wrapper = ({ children }: { children: React.ReactNode }) => (
	<IntlProvider locale="en" messages={{}}>
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

	it("shows popover with load button on hover, and iframe on click", async () => {
		render(
			<Wrapper>
				<DomainsFormatter domains={["example.com"]} />
			</Wrapper>,
		);
		const link = screen.getByText("example.com");
		fireEvent.mouseOver(link);

        // Check for Load Preview button
        // The mock translation renders the ID if translation is missing.
        await waitFor(() => {
            // "preview.load" is the ID used in T component
            const buttonText = screen.getByText("preview.load");
            expect(buttonText).toBeInTheDocument();
        }, { timeout: 2000 });

        // Click the button (wrapper of the text)
        const buttonText = screen.getByText("preview.load");
        fireEvent.click(buttonText);

        // Check for iframe
        await waitFor(() => {
            const iframe = document.querySelector("iframe");
            expect(iframe).toBeInTheDocument();
            expect(iframe).toHaveAttribute("src", "//example.com");
        });
	});

    it("does not show popover for wildcard domains", async () => {
        render(
            <Wrapper>
                <DomainsFormatter domains={["*.example.com"]} />
            </Wrapper>
        );
        const link = screen.getByText("*.example.com");
        fireEvent.mouseOver(link);

        // Should not show button
        await new Promise((r) => setTimeout(r, 600));
        const buttonText = screen.queryByText("preview.load");
        expect(buttonText).not.toBeInTheDocument();
    });
});
