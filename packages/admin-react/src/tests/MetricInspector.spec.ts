import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MetricInspector, type MetricInspectorOutcome } from "../libs/MetricInspector";

const result = {
  data: { privateCustomerName: "never-render-this-value" },
  definition: {
    id: "captures_total",
    version: 3,
    hash: "sha256:defined",
    sourceRefs: ["captures"],
  },
  unit: "minor-USD",
  population: "paid-captures",
  filter: "currency=USD",
  fieldRefs: ["amountMinor"],
  numerator: "captured-amount",
  denominator: "paid-captures",
  snapshotRefs: ["capture-snapshot-1"],
  quality: {
    temporalCompleteness: "complete",
    freshness: "fresh",
    populationCoverage: "complete",
    validity: "valid",
    exactness: "exact",
    reproducibility: "reproducible",
  },
  diagnostics: ["source-watermark-confirmed"],
} as const;

function render(outcome: MetricInspectorOutcome): string {
  return renderToStaticMarkup(createElement(MetricInspector, { outcome }));
}

describe("MetricInspector", () => {
  it("renders verified definition, provenance, quality and diagnostics without raw result data", () => {
    const html = render({ status: "verified", result });

    expect(html).toContain('data-state="verified"');
    for (const value of [
      "captures_total",
      "3",
      "sha256:defined",
      "minor-USD",
      "paid-captures",
      "currency=USD",
      "amountMinor",
      "captured-amount",
      "captures",
      "capture-snapshot-1",
      "source-watermark-confirmed",
    ]) {
      expect(html).toContain(value);
    }
    for (const axis of [
      "Temporal completeness",
      "Freshness",
      "Population coverage",
      "Validity",
      "Exactness",
      "Reproducibility",
    ]) {
      expect(html).toContain(axis);
    }
    expect(html).not.toContain("never-render-this-value");
  });

  it.each(["partial", "stale"] as const)(
    "renders %s provenance and quality without raw values",
    (status) => {
      const html = render({
        status,
        evidence: {
          ...result,
          quality: {
            ...result.quality,
            populationCoverage: "partial",
            freshness: status === "stale" ? "stale" : "fresh",
          },
          diagnostics: ["source-coverage-partial"],
        },
      });
      expect(html).toContain(`data-state="${status}"`);
      expect(html).toContain('role="alert"');
      expect(html).toContain("capture-snapshot-1");
      expect(html).toContain("source-coverage-partial");
      expect(html).toContain("Population coverage");
      expect(html).not.toContain("Verified metric evidence");
      expect(html).not.toContain("never-render-this-value");
    },
  );

  it.each(["denied", "unavailable"] as const)(
    "renders %s without disclosing metric evidence",
    (status) => {
      const html = render({ status });
      expect(html).toContain(`data-state="${status}"`);
      expect(html).toContain('role="alert"');
      expect(html).not.toContain("captures_total");
      expect(html).not.toContain("capture-snapshot-1");
    },
  );

  it("does not invent optional numerator, denominator or diagnostics", () => {
    const html = render({
      status: "verified",
      result: { ...result, numerator: undefined, denominator: undefined, diagnostics: [] },
    });

    expect(html).not.toContain("<dt>Numerator</dt>");
    expect(html).not.toContain("<dt>Denominator</dt>");
    expect(html).toContain("None reported");
  });
});
