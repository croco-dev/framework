import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CustomerExplorer } from "../libs/CustomerExplorer";
import type { CustomerExplorerOperations } from "../libs/CustomerExplorer";

const operations: CustomerExplorerOperations = {
  getSample: vi.fn(),
  timeline: vi.fn(),
  notes: vi.fn(),
  saveNote: vi.fn(),
  exportDraft: vi.fn(),
};
describe("CustomerExplorer", () => {
  it("renders an accessible scoped loading workspace before authorized reads finish", () => {
    const html = renderToStaticMarkup(
      createElement(CustomerExplorer, {
        scope: { appId: "app", environment: "test", tenantId: "tenant" },
        sampleId: "sample",
        operations,
      }),
    );
    expect(html).toContain('aria-label="Customer explorer"');
    expect(html).toContain('data-state="loading"');
    expect(html).toContain("Loading saved sample");
    expect(html).toContain("app / test / tenant");
    expect(html).not.toContain("Download");
    expect(html).not.toContain("Cohort");
    expect(operations.getSample).not.toHaveBeenCalled();
  });
});
