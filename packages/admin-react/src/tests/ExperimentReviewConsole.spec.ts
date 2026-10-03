import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement as h } from "react";

import { ExperimentReviewConsole } from "../libs/ExperimentReviewConsole";
import type { ExperimentReviewSnapshot, ExperimentReviewSource } from "@croco/admin-core";
import { loadExperimentReviewConsole } from "@croco/admin-core";
import type { ExperimentDatasetInput } from "@croco/metrics-core";

function makeDataset(): ExperimentDatasetInput {
  const assignments = [];
  for (let i = 0; i < 100; i += 1) {
    assignments.push({
      unitId: `control-${i}`,
      variantId: "control",
      attributes: { tier: "free" },
    });
  }
  for (let i = 0; i < 100; i += 1) {
    assignments.push({
      unitId: `treatment-${i}`,
      variantId: "treatment",
      attributes: { tier: "free" },
    });
  }
  const exposures = [
    ...assignments.slice(0, 80).map((row) => ({
      unitId: row.unitId,
      exposed: true,
      actionObserved: true,
      outcomeObserved: true,
    })),
    ...assignments.slice(100, 160).map((row) => ({
      unitId: row.unitId,
      exposed: true,
      actionObserved: true,
      outcomeObserved: true,
    })),
  ];
  const outcomes = [
    ...assignments.slice(0, 80).map((row, index) => ({
      unitId: row.unitId,
      value: index % 4 === 0 ? 1 : 0,
      complete: true,
    })),
    ...assignments.slice(100, 160).map((row, index) => ({
      unitId: row.unitId,
      value: index % 2 === 0 ? 1 : 0,
      complete: true,
    })),
  ];
  return {
    plan: {
      experimentId: "exp-1",
      revision: "r1",
      primaryMetricId: "signup",
      randomizationUnit: "unit",
      outcomeKind: "binary",
      observedWindow: { from: "2026-09-01T00:00:00.000Z", to: "2026-09-08T00:00:00.000Z" },
      variants: [
        { id: "control", plannedShare: 0.5 },
        { id: "treatment", plannedShare: 0.5 },
      ],
      srmWarningThreshold: 0.001,
      preTreatmentAttributes: ["tier"],
    },
    assignments,
    exposures,
    preTreatmentFacts: {},
    outcomes,
    completeThrough: "2026-09-08T00:00:00.000Z",
  };
}

async function readySnapshot(): Promise<ExperimentReviewSnapshot> {
  const source: ExperimentReviewSource = {
    requiredPermissions: ["experiments:read"],
    load: async () => ({
      kind: "ready",
      dataset: makeDataset(),
      generatedAt: new Date("2026-09-08T00:00:00.000Z"),
    }),
  };
  const state = await loadExperimentReviewConsole({
    source,
    appId: "shop",
    environment: "production",
    tenantId: "tenant-a",
    grantedPermissions: ["experiments:read", "experiments:report"],
  });
  if (state.kind !== "ready") throw new Error(`expected ready, got ${state.kind}`);
  return state.snapshot;
}

describe("ExperimentReviewConsole", () => {
  it("renders the ready review without winner language", async () => {
    const snapshot = await readySnapshot();
    const markup = renderToStaticMarkup(
      h(ExperimentReviewConsole, {
        state: {
          kind: "ready",
          snapshot,
          grantedPermissions: ["experiments:read", "experiments:report"],
          actions: [
            {
              kind: "generate-report",
              targetId: "exp-1@r1",
              scope: snapshot.scope,
              permission: "experiments:report",
              allowed: true,
              reason: "Export the reviewed snapshot",
              auditEvent: "experiments.admin.generate-report",
              possibleProblems: ["metrics-core/experiment-input-invalid"],
            },
          ],
        },
        onPageChange: () => undefined,
      }),
    );
    expect(markup).toContain("primary n = randomized denominator");
    expect(markup).toContain("No automatic winner: interpret quality signals before acting.");
    expect(markup).toContain("co***-0");
    expect(markup).not.toContain("control-0");
    expect(markup).toContain("descriptive - not randomized");
    expect(markup).toContain("Next page");
    expect(markup).not.toContain("declare-winner");
    expect(markup).not.toContain("winning variant");
  });

  it("renders permission-denied with an alert role", () => {
    const markup = renderToStaticMarkup(
      h(ExperimentReviewConsole, {
        state: {
          kind: "permission-denied",
          appId: "shop",
          environment: "production",
          requiredPermissions: ["experiments:read"],
          grantedPermissions: [],
          problem: {
            code: "admin-core/experiment-review-permission-denied",
            status: 403,
            title: "Experiment review permission denied",
            detail: "Missing permissions: experiments:read",
          },
        },
      }),
    );
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("experiments:read");
  });

  it("exposes variant selection and pagination as keyboard buttons", async () => {
    const snapshot = await readySnapshot();
    const markup = renderToStaticMarkup(
      h(ExperimentReviewConsole, {
        state: {
          kind: "ready",
          snapshot,
          grantedPermissions: ["experiments:read"],
          actions: [],
        },
        onSelectVariant: () => undefined,
        onPageChange: () => undefined,
      }),
    );
    expect(markup).toContain("<button");
    expect(markup).toContain("control · n=100");
  });
});
