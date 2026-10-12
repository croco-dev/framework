import assert from "node:assert/strict";
import { readFile, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { computePeriodicRetention } from "@croco/metrics-core";
import {
  importBehaviorSource,
  registerBehaviorQuery,
  MetricReadService,
} from "@croco/metrics-core/runtime";
import { createRetentionWorkbenchSource } from "@croco/admin-core";
import type { RetentionSavedView, RetentionSavedViewStore } from "@croco/admin-core";
import type { MetricReadContext } from "@croco/metrics-core/runtime";
import {
  definition,
  dataset,
  baseline,
  returning,
  scope,
  binding,
  schema,
  metadata,
} from "./fixture.js";

async function main() {
  async function* bytes() {
    yield await readFile(
      new URL(
        "../../../packages/metrics-core/src/tests/fixtures/behavior-events.jsonl",
        import.meta.url,
      ),
    );
  }
  const imported = await importBehaviorSource(bytes(), schema, binding, metadata, 300);
  assert.deepEqual(
    computePeriodicRetention(definition, imported, { baseline, returning }),
    computePeriodicRetention(definition, dataset, { baseline, returning }),
  );
  const limits = {
    maxWindowMs: 300 * 86400000,
    maxRows: 300,
    maxBytes: 100000,
    maxTimeMs: 1000,
    maxConcurrency: 1,
    maxCost: 300,
  };
  const context: MetricReadContext = {
    principal: {
      app: scope.appId,
      environment: scope.environment,
      tenant: scope.tenantId,
      subject: "demo-operator",
    },
    allowedFields: ["action"],
    allowRaw: false,
    budget: limits,
    sourceRevisions: [{ sourceRef: "example", revision: "synthetic-v1" }],
    snapshotRefs: ["synthetic-v1"],
  };
  const registration = await registerBehaviorQuery({
    definition,
    queryId: "weekly",
    queryVersion: 1,
    selection: { kind: "periodic", options: { baseline, returning } },
    scope,
    sourceRevisions: context.sourceRevisions,
    limits,
    requiredFields: ["action"],
    source: async () => ({
      dataset: imported,
      quality: {
        freshness: "fresh",
        temporalCompleteness: "complete",
        populationCoverage: "complete",
        validity: "valid",
        exactness: "exact",
        reproducibility: "reproducible",
      },
    }),
  });
  const service = new MetricReadService([registration.definition], [registration.query], {
    currentContext: () => context,
    authorize: async () => ({ permissionEpoch: "1", privacyEpoch: "1" }),
  });
  const result = await service.runRegisteredQuery("weekly", null, {
    from: new Date(definition.historyStart).toISOString(),
    to: new Date(returning.to).toISOString(),
  });
  assert.equal(result.status, "verified");
  assert.doesNotMatch(JSON.stringify(result), /subjectId|eventId/);
  const directory = await mkdtemp(join(tmpdir(), "croco-retention-"));
  const file = (authorized: typeof scope, subjectKind: string, id: string) =>
    join(
      directory,
      createHash("sha256")
        .update(JSON.stringify([authorized, subjectKind, id]))
        .digest("hex") + ".json",
    );
  const store = (): RetentionSavedViewStore => ({
    read: async (authorized, subjectKind, id) => {
      try {
        return JSON.parse(
          await readFile(file(authorized, subjectKind, id), "utf8"),
        ) as RetentionSavedView;
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT")
          return undefined;
        throw error;
      }
    },
    write: async (authorized, subjectKind, record) => {
      await writeFile(file(authorized, subjectKind, record.id), JSON.stringify(record), {
        flag: "wx",
      });
    },
  });
  const host = () =>
    createRetentionWorkbenchSource({
      definitions: [definition],
      adapter: {
        authorize: async (input) => JSON.stringify(input.scope) === JSON.stringify(scope),
        read: async (input) => {
          assert.equal(input.sourceRef, "synthetic-v1");
          return imported;
        },
        subjectLabel: async ({ subjectId }) =>
          "Subject " + createHash("sha256").update(subjectId).digest("hex").slice(0, 8),
      },
      maxEvents: 300,
      maxPageSize: 20,
      savedViews: store(),
    });
  const request = {
    definitionId: definition.id,
    definitionVersion: definition.version,
    subjectKind: definition.subjectKind,
    scope,
    sourceRef: "synthetic-v1",
    selections: [{ id: "weekly", kind: "periodic" as const, options: { baseline, returning } }],
  };
  const state = await host().load(request);
  assert.ok("snapshot" in state);
  const saved = await host().save(request, "weekly", state.snapshot.inputToken);
  assert.deepEqual(await host().readSaved(scope, "user", "weekly"), saved);
  console.log(
    "Standalone/import/registered query agree at 40/100; saved view survives host recreation.",
  );
}
void main();
