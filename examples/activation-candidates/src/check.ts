import assert from "node:assert/strict";
import { calculateActivationCandidates } from "@croco/metrics-core";
import {
  importActivationSource,
  MetricReadService,
  registerActivationQuery,
} from "@croco/metrics-core/runtime";
import { binding, definition, importedBytes, rows, schema } from "./fixture";

export async function checkSources() {
  const expected = calculateActivationCandidates(rows, definition);
  const first = expected.candidates[0];
  const second = expected.candidates[1];
  const third = expected.candidates[2];
  assert.ok(first && second && third);
  assert.deepEqual([first.eligibleN, first.DO, first.RE, first.NO], [100, 40, 30, 20]);
  assert.deepEqual(
    [first.precision.value, first.coverage.value, first.noRedo.value],
    [0.75, 0.6, 0.5],
  );
  assert.ok(
    first.precision.value !== null &&
      second.precision.value !== null &&
      third.precision.value !== null,
  );
  assert.ok(
    second.precision.value > first.precision.value &&
      third.precision.value > second.precision.value,
  );
  assert.ok(
    first.coverage.value !== null &&
      second.coverage.value !== null &&
      third.coverage.value !== null,
  );
  assert.ok(
    second.coverage.value < first.coverage.value && third.coverage.value < second.coverage.value,
  );
  for (const format of ["csv", "jsonl"] as const) {
    assert.deepEqual(
      (await importActivationSource(importedBytes(format), schema(format), binding, definition))
        .report,
      expected,
    );
  }
  const budget = {
    maxWindowMs: 86_400_000,
    maxRows: 1000,
    maxBytes: 200_000,
    maxTimeMs: 5000,
    maxConcurrency: 1,
    maxCost: 1000,
  };
  const registered = await registerActivationQuery({
    definition,
    limits: budget,
    requiredFields: ["normalized"],
    source: async () => ({
      rows,
      quality: {
        temporalCompleteness: "complete",
        freshness: "fresh",
        populationCoverage: "complete",
        validity: "valid",
        exactness: "exact",
        reproducibility: "reproducible",
      },
    }),
  });
  const service = new MetricReadService(
    [registered.definition],
    [registered.query],
    {
      currentContext: () => ({
        principal: {
          app: "activation-example",
          environment: "demo",
          tenant: "synthetic",
          subject: "operator",
        },
        allowedFields: ["normalized"],
        allowRaw: false,
        budget,
        sourceRevisions: [{ sourceRef: "normalized", revision: "v1" }],
        snapshotRefs: ["synthetic-100-v1"],
      }),
      authorize: async () => ({ permissionEpoch: "1", privacyEpoch: "1" }),
    },
    { readCandidates: async () => [], verify: async () => false },
  );
  const result = await service.runRegisteredQuery(definition.id, null, {
    from: "2026-08-01T00:00:00.000Z",
    to: "2026-08-02T00:00:00.000Z",
  });
  assert.equal(result.status, "verified");
  assert.ok(result.status === "verified");
  assert.deepEqual(result.result.data, expected);
  console.log("Golden denominators, CSV/JSONL parity and registered metric query passed.");
}
void checkSources().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
