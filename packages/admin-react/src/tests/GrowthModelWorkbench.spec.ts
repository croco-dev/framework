import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { GrowthModelWorkbench } from "../libs/GrowthModelWorkbench";
import type { GrowthWorkbenchRequest } from "@croco/admin-core";
const request: GrowthWorkbenchRequest = {
  scope: { appId: "app", environment: "test", tenantId: "tenant" },
  sourceRevision: "source",
  model: {
    id: "model",
    version: "v1",
    unit: "users",
    period: "week",
    stateDefinitions: [{ id: "active", label: "Active", evidence: "Value action" }],
    definitionCutoff: 0,
    transitionEstimationWindow: { from: 0, to: 1 },
    purpose: "Compare scenarios",
    assumptions: ["First order"],
  },
  scenario: {
    horizon: 1,
    initialPopulation: [10],
    inflows: { unit: "users", label: "assumption", rationale: "No inflows", values: [[0]] },
    matrixOverrides: [],
  },
  backtest: {
    trainEnd: 1,
    testWindow: { from: 2, to: 2 },
    errorMetric: "MAE",
    inflows: { unit: "users", label: "assumption", rationale: "No inflows", values: [[0]] },
  },
};
describe("GrowthModelWorkbench", () => {
  it("renders editable assumptions and a real calculate action, without claiming observations before reading", () => {
    const load = vi.fn();
    const html = renderToStaticMarkup(
      createElement(GrowthModelWorkbench, {
        initialRequest: request,
        client: { load, save: vi.fn(), readSaved: vi.fn() },
      }),
    );
    expect(html).toContain('data-state="empty"');
    expect(html).toContain("Calculate model and scenario");
    expect(html).toContain("replace-row");
    expect(html).toContain("stateDefinitions");
    expect(html).toContain("Save report revision");
    expect(load).not.toHaveBeenCalled();
    expect(html).not.toContain("Calculation ready");
  });
});
