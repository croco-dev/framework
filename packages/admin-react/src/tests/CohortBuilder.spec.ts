import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CohortBuilder } from "../libs/CohortBuilder";
import type { CohortBuilderState } from "@croco/admin-core";
function render(state: CohortBuilderState) {
  return renderToStaticMarkup(
    createElement(CohortBuilder, {
      definition: {
        id: "trial",
        version: 1,
        subjectKind: "user",
        scope: { appId: "app", environment: "test", tenantId: "tenant" },
        root: { kind: "fact", field: "plan", operator: "eq", value: "trial" },
      },
      registration: {
        fields: { plan: { type: "string", operators: ["eq"], values: ["trial", "paid"] } },
        events: [],
        memberships: [],
      },
      state,
      actor: "operator",
      asOf: "2026-09-27T00:00:00Z",
      canPreview: true,
      canPublish: true,
      onPreview: vi.fn(),
      onPublish: vi.fn(),
    }),
  );
}
describe("CohortBuilder", () => {
  it("renders registered choices and accessible controls", () => {
    const html = render({ kind: "ready", history: [] });
    expect(html).toContain('aria-label="Field"');
    expect(html).toContain('value="trial"');
    expect(html).not.toContain('value="gt"');
    expect(html).toContain("Preview cohort");
  });
  it("makes loading, denial and provider failure explicit", () => {
    expect(render({ kind: "loading" })).toContain("Loading registered fields");
    expect(render({ kind: "denied", code: "DENIED" })).toContain('role="alert"');
    expect(render({ kind: "failed", code: "SOURCE_UNAVAILABLE" })).toContain("SOURCE_UNAVAILABLE");
  });
  it.each(["queued", "running", "failed", "canceled"] as const)(
    "prevents publishing %s runs",
    (status) => {
      const html = render({
        kind: "ready",
        history: [],
        preview: {
          run: {
            id: "run",
            definitionVersion: 1,
            asOf: "2026-09-27T00:00:00Z",
            sourceSnapshotRefs: ["source"],
            sourceWatermarks: {},
            status,
          },
          total: 3,
          matched: 1,
          unknown: 1,
          sample: [],
        },
      });
      expect(html).toContain('<fieldset disabled=""><legend>Publish completed membership');
    },
  );
});
