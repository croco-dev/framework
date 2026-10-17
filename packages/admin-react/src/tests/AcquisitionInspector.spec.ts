import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AcquisitionInspector } from "../libs/AcquisitionInspector";
import type { AcquisitionInspectorState } from "@croco/admin-core/acquisition";

describe("acquisition inspector presentation", () => {
  it.each(["loading", "empty", "denied", "error", "partial"] as const)(
    "presents %s without fabricated credits",
    (kind) => {
      const html = renderToStaticMarkup(
        createElement(AcquisitionInspector, { state: { kind }, onRefresh() {} }),
      );
      expect(html).toContain("Refresh evidence");
      expect(html).not.toContain("credit 1");
      if (kind === "loading") expect(html).toContain("disabled");
      if (kind === "denied" || kind === "error") expect(html).toContain('role="alert"');
      if (kind === "partial") expect(html).toContain("partial history is not attributed");
    },
  );
  it("shows the engine-selected direct visit, inclusive window and distinct conversion count", () => {
    const state: AcquisitionInspectorState = {
      kind: "ready",
      comparison: {
        conversion: {
          ref: "purchase",
          identity: { kind: "subject", ref: "masked" },
          occurredAt: "2026-10-17T12:00:00.000Z",
        },
        revision: 8,
        conversionCount: 1,
        declarationStatus: "conflict",
        declarations: [],
        touchpoints: [],
        results: [
          {
            conversionRef: "purchase",
            modelId: "last-observed-touch",
            modelVersion: "1",
            definitionRevision: 2,
            window: {
              fromInclusive: "2026-10-10T12:00:00.000Z",
              toInclusive: "2026-10-17T12:00:00.000Z",
            },
            touchpointRefs: ["direct-visit"],
            credit: 0,
            status: "unattributed",
            channel: "unknown",
            coverage: "partial",
          },
        ],
      },
    };
    const html = renderToStaticMarkup(
      createElement(AcquisitionInspector, { state, onRefresh() {} }),
    );
    expect(html).toContain("Distinct conversions: 1");
    expect(html).toContain("Selected touchpoint: direct-visit");
    expect(html).toContain("unattributed · unknown · credit 0");
    expect(html).toContain("definition 2");
    expect(html).toContain("Separate declarations: conflict");
    expect(html).toContain("not lifetime first contact");
  });
});
