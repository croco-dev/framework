import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { GrowthAnalysisPanel } from "../libs/GrowthAnalysisPanel";

function render() {
  const propose = vi.fn();
  const execute = vi.fn();
  const html = renderToStaticMarkup(createElement(GrowthAnalysisPanel, { propose, execute }));
  return { html, propose, execute };
}

describe("GrowthAnalysisPanel", () => {
  it("starts with a bounded, labeled question and disables empty submission", () => {
    const { html } = render();
    expect(html).toContain('aria-label="Growth analysis"');
    expect(html).toContain('data-state="empty"');
    expect(html).toContain('aria-busy="false"');
    expect(html).toContain('maxLength="2000"');
    expect(html).toMatch(/<label for="([^"]+)">Analysis question<\/label><textarea id="\1"/);
    expect(html).toContain('<button type="submit" disabled="">Propose analysis</button>');
    expect(html).not.toContain("Analysis complete");
    expect(html).not.toContain("Confirm and run");
  });

  it("does not propose or execute during rendering", () => {
    const { propose, execute } = render();
    expect(propose).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });
});
