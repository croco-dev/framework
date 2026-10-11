import { describe, expect, it } from "vitest";

import {
  createExperimentReviewActions,
  createExperimentReviewUnitPage,
  loadExperimentReviewConsole,
  maskExperimentUnitId,
} from "../index";
import type { ExperimentReviewSource, ExperimentReviewSourceResult } from "../index";
import type { ExperimentDatasetInput } from "@croco/metrics-core";

function makeDataset(overrides: Partial<ExperimentDatasetInput> = {}): ExperimentDatasetInput {
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
    ...overrides,
  };
}

function readySource(dataset: ExperimentDatasetInput): ExperimentReviewSource {
  const result: ExperimentReviewSourceResult = {
    kind: "ready",
    dataset,
    generatedAt: new Date("2026-09-08T00:00:00.000Z"),
  };
  return {
    requiredPermissions: ["experiments:read"],
    load: async () => result,
  };
}

describe("ExperimentReviewConsole", () => {
  it("requires a tenant and never loads global data", async () => {
    const source = readySource(makeDataset());
    for (const tenantId of [undefined, null, "  "]) {
      const state = await loadExperimentReviewConsole({
        source,
        appId: "shop",
        environment: "production",
        tenantId: tenantId as string | null | undefined,
        grantedPermissions: ["experiments:read"],
      });
      expect(state.kind).toBe("tenant-required");
      if (state.kind === "tenant-required") {
        expect(state.problem.code).toBe("admin-core/experiment-review-tenant-required");
      }
    }
  });

  it("denies loading without the read permission", async () => {
    const state = await loadExperimentReviewConsole({
      source: readySource(makeDataset()),
      appId: "shop",
      environment: "production",
      tenantId: "tenant-a",
      grantedPermissions: [],
    });
    expect(state.kind).toBe("permission-denied");
    if (state.kind === "permission-denied") {
      expect(state.problem.code).toBe("admin-core/experiment-review-permission-denied");
    }
  });

  it("keeps the randomized denominator with a partial funnel", async () => {
    const state = await loadExperimentReviewConsole({
      source: readySource(makeDataset()),
      appId: "shop",
      environment: "production",
      tenantId: "tenant-a",
      grantedPermissions: ["experiments:read"],
    });
    expect(state.kind).toBe("ready");
    if (state.kind !== "ready") return;
    const control = state.snapshot.variants.find((variant) => variant.variantId === "control");
    const treatment = state.snapshot.variants.find((variant) => variant.variantId === "treatment");
    expect(control?.n).toBe(100);
    expect(treatment?.n).toBe(100);
    expect(control?.funnel).toMatchObject({ assigned: 100, exposed: 80 });
    expect(treatment?.funnel).toMatchObject({ assigned: 100, exposed: 60 });
    expect(state.snapshot.denominatorNote).toContain("randomized denominator");
    const conditional = state.snapshot.conditional.find((row) => row.variantId === "control");
    expect(conditional?.nExposed).toBe(80);
  });

  it("surfaces leakage warnings and masked unit ids", async () => {
    const dataset = makeDataset({
      treatmentReceived: [
        { unitId: "control-0", variantId: "treatment" },
        { unitId: "control-1", variantId: "control" },
      ],
    });
    const state = await loadExperimentReviewConsole({
      source: readySource(dataset),
      appId: "shop",
      environment: "production",
      tenantId: "tenant-a",
      grantedPermissions: ["experiments:read"],
    });
    expect(state.kind).toBe("ready");
    if (state.kind !== "ready") return;
    const leakage = state.snapshot.quality.find((check) => check.kind === "leakage");
    expect(leakage?.result).toBe("warning");
    expect(state.snapshot.leakageNote ?? "").toContain("cross variant");
    expect(maskExperimentUnitId("control-12345")).toBe("co***45");
    expect(maskExperimentUnitId("ab")).toBe("***");
    expect(state.snapshot.maskedUnits?.[0]).toBe(maskExperimentUnitId("control-0"));
    expect(state.snapshot.unitPage.total).toBe(200);
    expect(state.snapshot.unitPage.units).toHaveLength(50);
    expect(state.snapshot.unitPage.nextCursor).toBe("50");
  });

  it("pages masked units with bounded pages", () => {
    const page = createExperimentReviewUnitPage(makeDataset(), "50");
    expect(page.units).toHaveLength(50);
    expect(page.nextCursor).toBe("100");
    expect(page.total).toBe(200);
  });

  it("gates report actions on the report permission without a winner action", async () => {
    const state = await loadExperimentReviewConsole({
      source: readySource(makeDataset()),
      appId: "shop",
      environment: "production",
      tenantId: "tenant-a",
      grantedPermissions: ["experiments:read"],
    });
    expect(state.kind).toBe("ready");
    if (state.kind !== "ready") return;
    expect(state.actions.map((action) => action.kind)).toEqual(["generate-report"]);
    expect(state.actions[0]?.allowed).toBe(false);
    const allowed = createExperimentReviewActions(state.snapshot, [
      "experiments:read",
      "experiments:report",
    ]);
    expect(allowed[0]?.allowed).toBe(true);
  });

  it("maps source problems to the problem state", async () => {
    const source: ExperimentReviewSource = {
      requiredPermissions: ["experiments:read"],
      load: async () => {
        throw new Error("warehouse down");
      },
    };
    const state = await loadExperimentReviewConsole({
      source,
      appId: "shop",
      environment: "production",
      tenantId: "tenant-a",
      grantedPermissions: ["experiments:read"],
    });
    expect(state.kind).toBe("problem");
  });
});
