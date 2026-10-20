"use client";
import React, { useEffect, useState } from "react";
import {
  ExperimentRegion,
  ExperimentDeliveryClientProblem,
} from "../../../packages/frontend-react/src/libs/ExperimentRegion";
import type { ExperimentRegionDecision } from "../../../packages/frontend-react/src/libs/ExperimentRegion";
export default function PdpClient({
  snapshot,
  decision,
}: {
  snapshot: string;
  decision?: ExperimentRegionDecision;
}) {
  const [selected, select] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.pdpHydrated = snapshot;
  }, [snapshot]);
  return (
    <>
      {decision ? (
        <ExperimentRegion
          decision={decision}
          scopeKey="synthetic-session"
          activeScopeKey="synthetic-session"
          renderVariant={(variant, value) => <p data-experiment-copy={variant}>{value}</p>}
          fallback={<p data-experiment-copy="fallback">Explore the print</p>}
          report={async (input) => {
            const response = await fetch("/lab/expose", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(input),
            });
            if (!response.ok)
              throw new ExperimentDeliveryClientProblem("Synthetic display reporting failed");
            document.documentElement.dataset.pdpExposure = "reported";
          }}
          onObservationError={() => {
            document.documentElement.dataset.pdpExposure = "failed";
          }}
        />
      ) : (
        <p data-experiment-copy="disabled">Explore the print</p>
      )}
      <button
        id="trial-cta"
        type="button"
        aria-pressed={selected}
        onClick={() => select(!selected)}
      >
        Preview this print
      </button>
      <p role="status">{selected ? "Preview selected" : "No purchase is made by this preview."}</p>
    </>
  );
}
