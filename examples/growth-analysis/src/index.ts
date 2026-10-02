import assert from "node:assert/strict";
import { createFixture, deterministicProposal } from "./fixture";
import type { AnalysisPlan } from "@croco/analytics-core";

async function main(): Promise<void> {
  let modelCalls = 0;
  const fixture = createFixture(async (request) => {
    modelCalls++;
    return deterministicProposal(request);
  });
  const [metricDefinition] = await fixture.runner.listDefinitions();
  assert(metricDefinition);
  const plan: AnalysisPlan = {
    contextRef: fixture.contextRef(),
    queryId: fixture.registration.queryId,
    version: fixture.registration.version,
    parameters: fixture.registration.parameters,
    window: fixture.registration.window,
    assumptions: fixture.registration.assumptions,
    metricDefinition,
    coverage: "confirmation-required",
  };
  const outcome = await fixture.service.execute(plan);
  assert(outcome.status === "ready");
  assert.equal(outcome.answer.facts[0].value, "0.42");
  assert.equal(outcome.answer.source, "report");
  assert.equal(fixture.executions(), 0);
  assert.equal(modelCalls, 0);
  console.log(JSON.stringify({ outcome, executorCalls: fixture.executions(), modelCalls }));
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
