import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LearningWorkspace } from "../libs/LearningWorkspace";
import type { LearningWorkspaceProps } from "../libs/LearningWorkspace";

const scope = { appId: "app", environment: "test", tenantId: "one" };
const props: LearningWorkspaceProps = {
  scope,
  accessRevision: "permission-1",
  canWrite: true,
  canExport: false,
  state: {
    kind: "ready",
    draft: {
      id: "new",
      scope,
      revision: 0,
      question: "What helps?",
      desiredOutcome: "",
      facts: [],
      hypotheses: [
        {
          text: "Maybe a shorter checkout",
          state: "inconclusive",
          limitations: "",
          supportRefs: [],
        },
      ],
      evidenceRefs: [],
      decision: { text: "Deploy the UI" },
      nextActions: [],
      owner: "operator",
      status: "draft",
      tags: { action: [], target: [], metric: [] },
    },
  },
  onSave: async () => {
    throw new TypeError("Unused fixture");
  },
  onRead: async () => {
    throw new TypeError("Unused fixture");
  },
  onSearch: async () => ({ rows: [] }),
  onHistory: async () => [],
  onExport: async () => {
    throw new TypeError("Unused fixture");
  },
  onCopyDraft: async () => {
    throw new TypeError("Unused fixture");
  },
};
describe("LearningWorkspace", () => {
  it("exposes explicit state editors and never invents an experiment capability", () => {
    const html = renderToStaticMarkup(h(LearningWorkspace, props));
    expect(html).toContain("Observed facts");
    expect(html).toContain("Hypothesis 1 limitations");
    expect(html).toContain('<option selected="">inconclusive</option>');
    expect(html).toContain("Record status");
    expect(html).not.toContain("Create local experiment");
    expect(html).not.toContain("Export current");
  });
  it("rejects cross-scope drafts and separates loading, denied, error and an empty search page", () => {
    expect(
      renderToStaticMarkup(
        h(LearningWorkspace, { ...props, scope: { ...scope, tenantId: "two" } }),
      ),
    ).not.toContain("What helps?");
    for (const kind of ["loading", "denied", "error"] as const) {
      const state = kind === "loading" ? { kind } : { kind, message: "Access unavailable" };
      const html = renderToStaticMarkup(h(LearningWorkspace, { ...props, state }));
      expect(html).not.toContain("What helps?");
      expect(html).toContain(
        kind === "loading" ? "Loading learning records" : "Access unavailable",
      );
    }
    const html = renderToStaticMarkup(h(LearningWorkspace, { ...props, canWrite: false }));
    expect(html).toContain("fieldset disabled");
    expect(html).toContain("No records in this search page.");
  });
});
