import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

import { MetricInspector, type MetricInspectorOutcome } from "../libs/MetricInspector";

/** Browser regression fixture for the mounted inspector and its result-state transitions. */
export async function verifyMountedMetricInspector(
  container: HTMLElement,
  observe: (step: string) => Promise<void> = async () => {},
): Promise<void> {
  const root = createRoot(container);
  const render = (outcome: MetricInspectorOutcome): void => {
    flushSync(() => root.render(createElement(MetricInspector, { outcome })));
  };
  const assert = (condition: boolean, message: string): void => {
    if (!condition) throw new Error(message);
  };

  try {
    render({ status: "denied" });
    assert(
      container.querySelector('[data-state="denied"] [role="alert"]') !== null,
      "Denied state is missing",
    );
    assert(
      !container.textContent?.includes("Verified metric evidence"),
      "Denied state exposed metric evidence",
    );
    await observe("Access denied");

    render({
      status: "partial",
      evidence: {
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
        snapshotRefs: ["capture-snapshot-1"],
        quality: {
          temporalCompleteness: "partial",
          freshness: "fresh",
          populationCoverage: "partial",
          validity: "valid",
          exactness: "exact",
          reproducibility: "reproducible",
        },
        diagnostics: ["source-coverage-partial"],
      },
    });
    assert(
      container.querySelector('[data-state="partial"] [role="alert"]') !== null,
      "Partial state is missing",
    );
    assert(
      !container.textContent?.includes("Verified metric evidence"),
      "Partial state implied verification",
    );
    assert(
      container.textContent?.includes("capture-snapshot-1") === true,
      "Partial state lost snapshot provenance",
    );
    await observe("Partial evidence");

    render({
      status: "verified",
      result: {
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
      },
    });
    assert(
      container.querySelector('[data-state="verified"]') !== null,
      "Verified state is missing",
    );
    assert(
      container.textContent?.includes("capture-snapshot-1") === true,
      "Snapshot provenance is missing",
    );
    assert(container.textContent?.includes("amountMinor") === true, "Field provenance is missing");
    await observe("Verified evidence");
  } finally {
    root.unmount();
  }
}
