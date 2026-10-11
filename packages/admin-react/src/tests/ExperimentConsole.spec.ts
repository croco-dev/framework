import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ExperimentConsole } from "../libs/ExperimentConsole";
import type { ExperimentAdminSnapshot } from "@croco/admin-core";
const snapshot: ExperimentAdminSnapshot = {
  target: {
    experimentId: "checkout",
    experimentRevision: "1",
    scope: { app: "shop", environment: "test", tenantId: "tenant-a" },
  },
  definition: {
    id: "checkout",
    revision: "1",
    unit: "user",
    loginPolicy: "preserve-unit",
    allocatorVersion: "sha256-v1",
    allocation: 10000,
    variants: [{ id: "control", value: false, weight: 10000 }],
    hypothesis: "Checkout confidence",
    observationPlan: "Completed purchases",
    eligibility: "registered-buyers",
  },
  state: "draft",
  version: 0,
  samples: [{ id: "sample", label: "Demo buyer" }],
  canOperate: true,
  canPreview: true,
  canConfigure: true,
  eligibilityOptions: ["registered-buyers"],
};
const callbacks = {
  onCommand: vi.fn(),
  onConfigure: vi.fn(),
  onReload: vi.fn(),
  onPreview: vi.fn(),
};
describe("ExperimentConsole", () => {
  it("renders registered hypothesis, objective, false variant, ownership and sample preview", () => {
    const html = renderToString(
      h(ExperimentConsole, { state: { kind: "ready", snapshot }, ...callbacks }),
    );
    for (const text of [
      "Checkout confidence",
      "Completed purchases",
      "control",
      "false",
      "tenant-a",
      "Demo buyer",
      "Preview sample",
      "Create draft revision",
    ])
      expect(html).toContain(text);
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Start experiment<\/button>/);
  });
  it.each([
    ["2030-01-02T03:00:00+09:00", "2030-01-01T18:00:00.000"],
    ["2030-01-02T23:00:00-05:00", "2030-01-03T04:00:00.000"],
  ])("renders %s as UTC in both schedule inputs", (timestamp, utc) => {
    const html = renderToString(
      h(ExperimentConsole, {
        state: {
          kind: "ready",
          snapshot: {
            ...snapshot,
            definition: { ...snapshot.definition, startsAt: timestamp, endsAt: timestamp },
          },
        },
        ...callbacks,
      }),
    );
    expect(html.match(/type="datetime-local" value="([^"]*)"/g)).toEqual([
      `type="datetime-local" value="${utc}"`,
      `type="datetime-local" value="${utc}"`,
    ]);
  });
  it("renders failure as an alert with reload and removes stale operation controls", () => {
    const html = renderToString(
      h(ExperimentConsole, {
        state: { kind: "error", message: "Storage unavailable" },
        ...callbacks,
      }),
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Storage unavailable");
    expect(html).toContain("Reload experiment");
    expect(html).not.toContain("Start experiment");
  });
  it("marks loading and disables read-only mutation fieldsets", () => {
    expect(
      renderToString(h(ExperimentConsole, { state: { kind: "loading" }, ...callbacks })),
    ).toContain('aria-busy="true"');
    const html = renderToString(
      h(ExperimentConsole, {
        state: { kind: "ready", snapshot: { ...snapshot, canConfigure: false, canOperate: false } },
        ...callbacks,
      }),
    );
    expect(html).toMatch(/<fieldset disabled=""><legend>Configure/);
    expect(html).toMatch(/<fieldset disabled=""><legend>Run experiment/);
  });
});
