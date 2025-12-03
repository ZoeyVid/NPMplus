import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { DomainsFormatter } from "./DomainsFormatter";
import { IntlProvider } from "react-intl";
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

	it("shows popover with load button on hover, and iframe on click", async () => {
		render(
			<Wrapper>
				<DomainsFormatter domains={["example.com"]} />
			</Wrapper>,
		);
		const link = screen.getByText("example.com");
		fireEvent.mouseEnter(link);

        // Check for Load Preview button
        await waitFor(() => {
            const buttonText = screen.getByText("Load Preview");
            expect(buttonText).toBeInTheDocument();
        }, { timeout: 2000 });

        // Click the button (wrapper of the text)
        const buttonText = screen.getByText("Load Preview");
        fireEvent.click(buttonText);

        // Check for iframe
        await waitFor(() => {
            const iframe = document.querySelector("iframe");
            expect(iframe).toBeInTheDocument();
            expect(iframe).toHaveAttribute("src", "//example.com");
        });

        // Check for Open in Popup button
        const popupButton = screen.getByText("Open in Popup");
        expect(popupButton).toBeInTheDocument();
	});

    it("does not show popover for wildcard domains", async () => {
        render(
            <Wrapper>
                <DomainsFormatter domains={["*.example.com"]} />
            </Wrapper>
        );
        const link = screen.getByText("*.example.com");
        fireEvent.mouseEnter(link);

        // Should not show button
        await new Promise((r) => setTimeout(r, 600));
        const buttonText = screen.queryByText("Load Preview");
        expect(buttonText).not.toBeInTheDocument();
    });
});
