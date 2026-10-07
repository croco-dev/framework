import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { postgresResource } from "@croco/testing-resources";
import { c, compileFact, defineFact, encodeIdentity, validateRow } from "@croco/warehouse-core";
import {
  installPostgresFactSchema,
  installPostgresWarehouseSchema,
  PostgresWarehouseCatalog,
  PostgresWarehouseReader,
  PostgresWarehouseWriter,
} from "@croco/warehouse-postgres/facts";
import { calculateActivationCandidates } from "@croco/metrics-core";
import { calculateActivationSource, readActivationWarehouse } from "@croco/metrics-core/runtime";
import type { WarehouseAccess, WarehouseQuality } from "@croco/warehouse-core/runtime";
import { binding, definition, flatRows, rows } from "./fixture";

async function main() {
  const resource = postgresResource({ id: "activation-candidates", mode: "commit" });
  const started = await resource.start({
    register: () => undefined,
    testId: randomUUID(),
    workerId: "activation-candidates",
  });
  const cancellationPool = new Pool({
    connectionString: started.connection.connectionString,
    max: 1,
  });
  try {
    const pool = started.connection.pool;
    const descriptor = await compileFact(
      defineFact("activation_subjects", {
        version: 1,
        kind: "transaction",
        scope: "tenant",
        grain: { description: "One subject in a normalized source run", key: ["subjectId"] },
        columns: {
          subjectId: c.id(),
          anchorAt: c.instant({ precision: "millisecond" }),
          cohort: c.string(),
          outcome: c.string(),
          completeThrough: c.instant({ precision: "millisecond" }),
          weekFrequency: c.int64({ min: 0n }),
          fortnightFrequency: c.int64({ min: 0n }),
          weekDays: c.int64({ min: 0n }),
          fortnightDays: c.int64({ min: 0n }),
        },
        time: { event: "anchorAt" },
        write: { mode: "append", duplicate: "ignore-identical", conflict: "reject" },
      }),
    );
    await installPostgresWarehouseSchema(pool);
    await installPostgresFactSchema(pool, descriptor);
    let access: WarehouseAccess = {
      scope: { application: "activation-example", environment: "demo", tenant: "synthetic" },
      actor: "operator",
      roles: ["read", "import", "publish", "drop"],
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
      transformHash: "normalized-v1",
      sourceRefs: ["synthetic-100-v1"],
      expectedHead: null,
      partitionSelection: null,
      audit: audit("Import normalized synthetic subjects"),
    });
    await writer.write({
      access,
      candidateId: candidate.id,
      fence: candidate.fence,
      batchId: "subjects",
      attempt: 1,
      rows: flatRows.map((row) =>
        validateRow(descriptor, {
          ...row,
          weekFrequency: String(row.weekFrequency),
          fortnightFrequency: String(row.fortnightFrequency),
          weekDays: String(row.weekDays),
          fortnightDays: String(row.fortnightDays),
        }),
      ),
    });
    const quality: WarehouseQuality = {
      freshness: {
        observedAt: "2026-08-30T00:00:00.000Z",
        newestEventAt: "2026-08-01T00:00:00.000Z",
      },
      temporalCompleteness: "complete",
      populationCoverage: "complete",
      validity: "valid",
      reproducibility: "reproducible",
      sourceCoverage: [
        {
          sourceRef: "synthetic-100-v1",
          from: "2026-08-01",
          through: "2026-08-30",
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
      expectedBatchIds: ["subjects"],
      quality,
      audit: audit("Verify complete cohort"),
    });
    const snapshot = await catalog.publishCandidate({
      access,
      candidateId: candidate.id,
      fence: candidate.fence,
      audit: audit("Publish verified cohort"),
    });
    const request = {
      access,
      snapshotId: snapshot.id,
      projection: Object.keys(descriptor.columns),
      filters: [],
      order: [{ column: "subjectId", direction: "asc" as const }],
      maxRows: 17,
      maxBytes: 32768,
      timeoutMs: 5000,
    };
    const nativeDefinition = {
      ...definition,
      sourceRevisions: { normalized: snapshot.id },
      sourceRunRef: snapshot.id,
    };
    const stream = readActivationWarehouse(reader, request, {
      maxRows: 100,
      maxBytes: 200_000,
      maxPages: 10,
    });
    const iterator = stream[Symbol.asyncIterator]();
    const initial = await iterator.next();
    assert.ok(!initial.done);
    const first = await reader.read(request);
    assert.ok(first.nextCursor);
    const seed = flatRows[0];
    assert.ok(seed);
    const extra = {
      ...seed,
      subjectId: "subject-100",
      weekFrequency: "0",
      fortnightFrequency: "0",
      weekDays: "0",
      fortnightDays: "0",
    };
    const nextAudit = (reason: string) => ({ ...audit(reason), expectedRevision: 1 });
    const next = await catalog.createCandidate({
      access,
      id: randomUUID(),
      transformHash: "normalized-v2",
      sourceRefs: ["synthetic-101-v2"],
      expectedHead: snapshot.id,
      partitionSelection: null,
      audit: nextAudit("Append one subject"),
    });
    await writer.write({
      access,
      candidateId: next.id,
      fence: next.fence,
      batchId: "extra",
      attempt: 1,
      rows: [validateRow(descriptor, extra)],
    });
    await catalog.sealCandidate({
      access,
      candidateId: next.id,
      fence: next.fence,
      expectedBatchIds: ["extra"],
      quality: {
        ...quality,
        sourceCoverage: quality.sourceCoverage.map((source) => ({
          ...source,
          sourceRef: "synthetic-101-v2",
        })),
      },
      audit: nextAudit("Verify appended subject"),
    });
    const advanced = await catalog.publishCandidate({
      access,
      candidateId: next.id,
      fence: next.fence,
      audit: nextAudit("Advance publication during read"),
    });
    async function* resumed() {
      yield initial.value;
      while (true) {
        const nextRow = await iterator.next();
        if (nextRow.done) return;
        yield nextRow.value;
      }
    }
    const report = await calculateActivationSource(resumed(), binding, nativeDefinition);
    assert.deepEqual(report.report, calculateActivationCandidates(rows, nativeDefinition));
    const current = await calculateActivationSource(
      readActivationWarehouse(
        reader,
        { ...request, snapshotId: advanced.id },
        { maxRows: 101, maxBytes: 200_000, maxPages: 10 },
      ),
      binding,
      {
        ...nativeDefinition,
        sourceRevisions: { normalized: advanced.id },
        sourceRunRef: advanced.id,
      },
    );
    assert.equal(current.report.rowCount, 101);
    const suppression = await catalog.suppress({
      access,
      identities: [encodeIdentity(descriptor, extra, access.scope)],
      audit: { ...audit("Erase appended subject"), expectedRevision: 2 },
    });
    access = { ...access, privacyEpoch: suppression.privacyEpoch };
    await assert.rejects(reader.read({ ...request, cursor: first.nextCursor }));
    await assert.rejects(reader.read({ ...request, access, cursor: first.nextCursor }));
    await assert.rejects(reader.read({ ...request, access }));
    console.log(
      "Native PostgreSQL publication, pinned pagination, denominator parity and privacy cursor denial passed.",
    );
  } finally {
    await cancellationPool.end();
    await started.dispose();
  }
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
