import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { postgresResource } from "@croco/testing-resources";
import { decodeSource } from "@croco/etl-core/source";
import { c, compileFact, defineFact, validateRow } from "@croco/warehouse-core";
import {
  installPostgresWarehouseSchema,
  installPostgresFactSchema,
  PostgresWarehouseCatalog,
  PostgresWarehouseWriter,
  PostgresWarehouseReader,
} from "@croco/warehouse-postgres/facts";
import {
  collectBehaviorSource,
  readBehaviorWarehouse,
  registerBehaviorQuery,
  MetricReadService,
} from "@croco/metrics-core/runtime";
import {
  computePeriodicRetention,
  computeCohortRetention,
  computeFrequencyDistribution,
} from "@croco/metrics-core";
import type { WarehouseAccess, WarehouseQuality } from "@croco/warehouse-core/runtime";
import {
  definition,
  dataset,
  scope,
  baseline,
  returning,
  metadata,
  schema,
  binding,
} from "./fixture.js";

async function main() {
  const started = await postgresResource({ id: "behavior-retention", mode: "commit" }).start({
    register: () => undefined,
    testId: randomUUID(),
    workerId: "behavior-retention",
  });
  const cancellationPool = new Pool({
    connectionString: started.connection.connectionString,
    max: 1,
  });
  try {
    const pool = started.connection.pool;
    const descriptor = await compileFact(
      defineFact("behavior_events", {
        version: 1,
        kind: "transaction",
        scope: "tenant",
        grain: { description: "One confirmed behavior event", key: ["source", "eventId"] },
        columns: {
          subjectId: c.id(),
          source: c.string(),
          eventId: c.id(),
          occurredAt: c.instant({ precision: "millisecond" }),
          action: c.string(),
        },
        time: { event: "occurredAt" },
        write: { mode: "append", duplicate: "ignore-identical", conflict: "reject" },
      }),
    );
    await installPostgresWarehouseSchema(pool);
    await installPostgresFactSchema(pool, descriptor);
    const access: WarehouseAccess = {
      scope: { application: scope.appId, environment: scope.environment, tenant: scope.tenantId },
      actor: "demo-operator",
      roles: ["read", "import", "publish"],
      columns: Object.keys(descriptor.columns),
      permissionEpoch: 0,
      privacyEpoch: 0,
    };
    const catalog = new PostgresWarehouseCatalog(pool, descriptor, () => access);
    const writer = new PostgresWarehouseWriter(pool, descriptor, () => access);
    const reader = new PostgresWarehouseReader(
      pool,
      descriptor,
      () => access,
      randomUUID(),
      cancellationPool,
    );
    const audit = (reason: string) => ({
      reason,
      expectedRevision: 0,
      idempotencyKey: randomUUID(),
    });
    const candidate = await catalog.createCandidate({
      access,
      id: randomUUID(),
      transformHash: "behavior-v1",
      sourceRefs: ["example"],
      expectedHead: null,
      partitionSelection: null,
      audit: audit("Load synthetic retention observations"),
    });
    async function* bytes() {
      yield await readFile(
        new URL(
          "../../../packages/metrics-core/src/tests/fixtures/behavior-events.jsonl",
          import.meta.url,
        ),
      );
    }
    const rows = [];
    for await (const row of decodeSource(bytes(), schema))
      rows.push(
        validateRow(descriptor, {
          subjectId: row.subjectId,
          source: row.source,
          eventId: row.eventId,
          occurredAt: new Date(String(row.occurredAt)).toISOString(),
          action: row.action,
        }),
      );
    await writer.write({
      access,
      candidateId: candidate.id,
      fence: candidate.fence,
      batchId: "events",
      attempt: 1,
      rows,
    });
    const quality: WarehouseQuality = {
      freshness: { observedAt: returning.to, newestEventAt: "2026-09-15T14:00:00Z" },
      temporalCompleteness: "complete",
      populationCoverage: "complete",
      validity: "valid",
      reproducibility: "reproducible",
      sourceCoverage: [
        {
          sourceRef: "example",
          from: definition.historyStart,
          through: returning.to,
          state: "complete",
          gaps: [],
          late: false,
        },
      ],
    };
    await catalog.sealCandidate({
      access,
      candidateId: candidate.id,
      fence: candidate.fence,
      expectedBatchIds: ["events"],
      quality,
      audit: audit("Verify synthetic coverage"),
    });
    const snapshot = await catalog.publishCandidate({
      access,
      candidateId: candidate.id,
      fence: candidate.fence,
      audit: audit("Publish synthetic retention evidence"),
    });
    const request = {
      access,
      snapshotId: snapshot.id,
      projection: Object.keys(descriptor.columns),
      filters: [],
      order: [{ column: "eventId", direction: "asc" as const }],
      maxRows: 17,
      maxBytes: 10000,
      timeoutMs: 5000,
    };
    const warehouseBinding = {
      subjectId: binding.subjectId,
      source: binding.source,
      eventId: binding.eventId,
      occurredAt: binding.occurredAt,
      action: binding.action,
    };
    const native = await collectBehaviorSource(
      readBehaviorWarehouse(reader, request, { maxRows: 300, maxBytes: 100000, maxPages: 20 }),
      warehouseBinding,
      { ...metadata, sourceRef: snapshot.id },
      300,
    );
    assert.deepEqual(
      computePeriodicRetention(definition, native, { baseline, returning }),
      computePeriodicRetention(definition, dataset, { baseline, returning }),
    );
    assert.deepEqual(
      computeCohortRetention(definition, native, { baseline, returning }),
      computeCohortRetention(definition, dataset, { baseline, returning }),
    );
    for (const measure of ["count", "activeDays"] as const)
      assert.deepEqual(
        computeFrequencyDistribution(definition, native, { window: returning, measure }),
        computeFrequencyDistribution(definition, dataset, { window: returning, measure }),
      );
    const budget = {
      maxWindowMs: 300 * 86400000,
      maxRows: 300,
      maxBytes: 100000,
      maxTimeMs: 5000,
      maxConcurrency: 1,
      maxCost: 300,
    };
    const context = {
      principal: {
        app: scope.appId,
        environment: scope.environment,
        tenant: scope.tenantId,
        subject: access.actor,
      },
      allowedFields: ["action"],
      allowRaw: false,
      budget,
      sourceRevisions: [{ sourceRef: "example", revision: snapshot.id }],
      snapshotRefs: [snapshot.id],
    };
    assert.equal(snapshot.quality.temporalCompleteness, "complete");
    assert.equal(snapshot.quality.populationCoverage, "complete");
    const registration = await registerBehaviorQuery({
      definition,
      queryId: "weekly",
      queryVersion: 1,
      selection: { kind: "periodic", options: { baseline, returning } },
      scope,
      sourceRevisions: context.sourceRevisions,
      limits: budget,
      requiredFields: ["action"],
      source: async (_context, signal) => ({
        dataset: await collectBehaviorSource(
          readBehaviorWarehouse(
            reader,
            { ...request, signal },
            { maxRows: 300, maxBytes: 100000, maxPages: 20 },
          ),
          warehouseBinding,
          { ...metadata, sourceRef: snapshot.id },
          300,
          signal,
        ),
        quality: {
          freshness: "fresh",
          temporalCompleteness:
            snapshot.quality.temporalCompleteness === "complete" ? "complete" : "partial",
          populationCoverage:
            snapshot.quality.populationCoverage === "complete" ? "complete" : "partial",
          validity: snapshot.quality.validity === "valid" ? "valid" : "invalid",
          exactness: "exact",
          reproducibility: snapshot.quality.reproducibility,
        },
      }),
    });
    const service = new MetricReadService([registration.definition], [registration.query], {
      currentContext: () => context,
      authorize: async () => ({ permissionEpoch: "0", privacyEpoch: "0" }),
    });
    const outcome = await service.runRegisteredQuery("weekly", null, {
      from: new Date(definition.historyStart).toISOString(),
      to: new Date(returning.to).toISOString(),
    });
    assert.equal(outcome.status, "verified");
    const {
      subjects: _subjects,
      sourceRefs: _sourceRefs,
      ...expectedAggregate
    } = computePeriodicRetention(definition, native, { baseline, returning });
    if (outcome.status === "verified") assert.deepEqual(outcome.result.data, expectedAggregate);
    const first = await reader.read(request);
    assert.ok(first.nextCursor);
    await assert.rejects(
      reader.read({
        ...request,
        access: { ...access, scope: { ...access.scope, tenant: "other" } },
        cursor: first.nextCursor,
      }),
    );
    await assert.rejects(
      collectBehaviorSource(
        readBehaviorWarehouse(reader, request, { maxRows: 1, maxBytes: 100000, maxPages: 20 }),
        warehouseBinding,
        metadata,
        300,
      ),
    );
    await assert.rejects(reader.read({ ...request, signal: AbortSignal.abort() }));
    console.log(
      "Real PostgreSQL paged retention matches normalized 40/100, cohort, count3/day1; cursor scope, limits and cancellation verified.",
    );
  } finally {
    await cancellationPool.end();
    await started.dispose?.();
  }
}
void main();
