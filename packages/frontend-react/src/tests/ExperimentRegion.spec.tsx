import { fileURLToPath } from "node:url";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ExperimentRegion } from "../libs/ExperimentRegion";
import type { ExperimentRegionDecision } from "../libs/ExperimentRegion";
import { runExperienceSlotProcess, TEST_TIMEOUT_MS } from "./experienceSlotProcess.cjs";
const decision: ExperimentRegionDecision = {
  region: "hero",
  deliveryId: "delivery-a",
  policyRevision: "p1",
  experimentRevision: "v1",
  status: "assigned",
  variant: "assurance",
  value: "Payment protected",
  receipt: "opaque",
  phase: "admitted",
  validUntil: "2026-10-01T12:00:00Z",
};
describe("ExperimentRegion", () => {
  it("renders the frozen server variant without treating server rendering as exposure", () => {
    const report = vi.fn();
    const html = renderToString(
      h(ExperimentRegion, {
        decision,
        scopeKey: "generation-1",
        activeScopeKey: "generation-1",
        renderVariant: (variant, value) => h("button", { "data-variant": variant }, String(value)),
        fallback: "Standard",
        report,
      }),
    );
    expect(html).toContain("Payment protected");
    expect(html).toContain('data-variant="assurance"');
    expect(report).not.toHaveBeenCalled();
    expect(html).not.toContain("opaque");
  });
  it.each(["speculative", "obsolete", "fallback"])("does not render treatment for %s", (state) => {
    const html = renderToString(
      h(ExperimentRegion, {
        decision: {
          ...decision,
          phase: state === "speculative" ? "speculative" : "admitted",
          status: state === "fallback" ? "fallback" : "assigned",
        },
        scopeKey: "old",
        activeScopeKey: state === "obsolete" ? "new" : "old",
        renderVariant: () => "Payment protected",
        fallback: "Standard",
        report: async () => {},
      }),
    );
    expect(html).toContain("Standard");
    expect(html).not.toContain("Payment protected");
  });
});

describe("ExperimentRegion mounted failure isolation", () => {
  it(
    "keeps fallback or delivered UI usable for synchronous callback errors and malformed admission",
    async () => {
      const output = await runExperienceSlotProcess(
        fileURLToPath(new URL("./fixtures/experienceSlotProcessFixture.cjs", import.meta.url)),
        { args: ["experiment-region-cleanup"] },
      );
      expect(JSON.parse(output)).toEqual([
        { kind: "admission-sync", errorReported: true, usable: true },
        { kind: "report-sync", errorReported: true, usable: true },
        { kind: "admission-null", errorReported: true, usable: true },
      ]);
    },
    TEST_TIMEOUT_MS,
  );
});
