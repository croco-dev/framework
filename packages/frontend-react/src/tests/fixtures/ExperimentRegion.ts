import { createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { ExperimentRegion } from "../../libs/ExperimentRegion";
import type { ExperimentRegionDecision } from "../../libs/ExperimentRegion";

export function mountExperimentRegionProbe(
  kind: "admission-sync" | "report-sync" | "admission-null" | "visibility",
) {
  const probe = { errors: [] as string[], clicks: 0, reports: 0 };
  Object.assign(window, { regionProbe: probe });
  const container = document.getElementById("root");
  if (!container) throw new Error("Missing probe root");
  const decision: ExperimentRegionDecision = {
    region: "hero",
    deliveryId: "probe-delivery",
    policyRevision: "p1",
    experimentRevision: "v1",
    status: "assigned",
    variant: "assurance",
    value: "Payment protected",
    receipt: "opaque",
    phase: kind === "report-sync" || kind === "visibility" ? "admitted" : "speculative",
    validUntil: "2026-10-01T12:00:00Z",
  };
  createRoot(container).render(
    h(ExperimentRegion, {
      decision,
      scopeKey: "current",
      activeScopeKey: "current",
      fallback: h("p", null, "Standard checkout"),
      renderVariant: (_variant, value) =>
        h(
          "button",
          {
            onClick: () => {
              probe.clicks += 1;
            },
          },
          String(value),
        ),
      admit: () => {
        if (kind === "admission-sync") throw new Error("sync admission offline");
        return Promise.resolve(null as unknown as ExperimentRegionDecision);
      },
      report: () => {
        probe.reports += 1;
        if (kind === "visibility") return Promise.resolve();
        throw new Error("sync observation offline");
      },
      onObservationError: (error) => {
        probe.errors.push(String(error));
      },
    }),
  );
}
