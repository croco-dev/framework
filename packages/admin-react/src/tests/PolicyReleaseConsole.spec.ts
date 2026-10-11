import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PolicyReleaseConsole } from "../libs/PolicyReleaseConsole";
import type {
  PolicyReleaseConsoleProps,
  PolicyReleaseConsoleState,
} from "../libs/PolicyReleaseConsole";

const ready: PolicyReleaseConsoleState = {
  kind: "ready",
  policyId: "banner",
  revision: 3,
  status: "draft",
  fields: [
    { key: "title", label: "Banner title", input: "text", value: "Hello" },
    { key: "limit", label: "Frequency limit", input: "number", value: 3, min: 1, max: 5 },
  ],
  diagnostics: [],
  diff: [{ field: "title", before: "Old", after: "Hello" }],
  impact: [
    { kind: "fact", message: "Title changed" },
    { kind: "estimate", message: "Audience estimate" },
    { kind: "insufficient-data", message: "No historical outcomes" },
  ],
  canWrite: true,
  canReview: true,
  canPublish: true,
};
function render(
  state: PolicyReleaseConsoleState,
  overrides: Partial<PolicyReleaseConsoleProps> = {},
): string {
  return renderToStaticMarkup(
    h(PolicyReleaseConsole, {
      state,
      reason: "Update banner",
      effectiveAt: "",
      onReasonChange: vi.fn(),
      onEffectiveAtChange: vi.fn(),
      onEdit: vi.fn(),
      onSave: vi.fn(),
      onReview: vi.fn(),
      onPublish: vi.fn(),
      onReload: vi.fn(),
      ...overrides,
    }),
  );
}
describe("PolicyReleaseConsole", () => {
  it("renders code-declared bounded inputs, diff and three evidence classes", () => {
    const html = render(ready);
    expect(html).toContain('name="title"');
    expect(html).toContain('min="1" max="5"');
    expect(html).toContain("title: Old → Hello");
    for (const kind of ["fact", "estimate", "insufficient-data"])
      expect(html).toContain(`data-impact-kind="${kind}"`);
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Publish reviewed revision/);
    expect(html).not.toContain("handler");
  });
  it("renders datetime, select and JSON descriptors and permits warnings", () => {
    const html = render({
      ...ready,
      reviewHash: "review-3",
      reviewRequirements: { risk: "financial", independentReviewer: false },
      diagnostics: [{ code: "ESTIMATE", path: "audience", severity: "warning" }],
      fields: [
        { key: "at", label: "Start UTC", input: "datetime", value: "2026-10-01T12:00:00Z" },
        {
          key: "mode",
          label: "Mode",
          input: "select",
          value: "all",
          options: [{ value: "all", label: "Everyone" }],
        },
        { key: "rules", label: "Rules", input: "json", value: { enabled: true } },
        { key: "enabled", label: "Enabled", input: "boolean", value: true },
      ],
    });
    expect(html).toContain('type="datetime-local"');
    expect(html).toContain('value="2026-10-01T12:00:00"');
    expect(html).toContain('value="all" selected=""');
    expect(html).toMatch(/<textarea[^>]*name="rules"/);
    expect(html).toMatch(/type="checkbox"[^>]*checked=""/);
    expect(html).toContain('data-severity="warning"');
    expect(html).toContain("financial risk: Independent reviewer required");
    expect(html).toMatch(/<button type="button">Review revision/);
    expect(html).toMatch(/<button type="button">Publish reviewed revision/);
  });
  it("renders redacted sensitive values as a blank password replacement field", () => {
    const html = render({
      ...ready,
      fields: [{ key: "secret", label: "Secret", input: "text", value: null, sensitive: true }],
    });
    expect(html).toContain('type="password"');
    expect(html).toContain('value=""');
    expect(html).toContain("Value hidden; enter replacement");
    expect(html).not.toContain('value="null"');
  });
  it("lets a reviewer supply a reason without write permission", () => {
    const html = render({ ...ready, canWrite: false });
    expect(html.indexOf("Change reason")).toBeLessThan(html.indexOf("<fieldset disabled"));
    expect(html).toMatch(/<button type="button">Review revision/);
  });
  it("requires review, permission, reason and valid state for publish", () => {
    expect(render({ ...ready, reviewHash: "review-3" })).toMatch(
      /<button type="button">Publish reviewed revision/,
    );
    for (const state of [
      { ...ready, reviewHash: "review-3", canPublish: false },
      {
        ...ready,
        reviewHash: "review-3",
        diagnostics: [{ code: "LIMIT", path: "limit", severity: "error" as const }],
      },
      { ...ready, reviewHash: "review-3", status: "published" },
    ]) {
      expect(render(state)).toMatch(/<button[^>]*disabled[^>]*>Publish reviewed revision/);
    }
    expect(render({ ...ready, reviewHash: "review-3" }, { reason: "" })).toMatch(
      /<button[^>]*disabled[^>]*>Publish reviewed revision/,
    );
  });
  it("shows schedule and receipt without claiming publication during work", () => {
    const html = render(
      {
        ...ready,
        reviewHash: "review-3",
        receipt: { id: "cmd-1", revision: 3, status: "scheduled" },
      },
      { effectiveAt: "2026-10-01T12:00:00Z", busy: true },
    );
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Schedule reviewed revision");
    expect(html).toContain("cmd-1: revision 3, scheduled");
  });
  it("renders denied/error/recovery and loading/empty without privileged controls", () => {
    for (const kind of ["denied", "error", "partial"] as const) {
      const html = render({ kind, code: "POLICY_DENIED", message: "Access unavailable" });
      expect(html).toContain('role="alert"');
      expect(html).toContain("Reload policy");
      expect(html).not.toContain("Save draft");
    }
    expect(render({ kind: "loading" })).toContain('aria-busy="true"');
    expect(render({ kind: "empty" })).toContain("No policy revision");
  });
});
