import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { postgresResource } from "@croco/testing-resources";
import { c, compileFact, defineFact, validateRow } from "@croco/warehouse-core";
import {
  compareAssignedOutcomes,
  hashAssignedOutcomeDefinition,
  hashAssignedOutcomeInput,
} from "@croco/metrics-core";
import {
  ASSIGNED_OUTCOME_FIELDS,
  ASSIGNED_OUTCOME_WAREHOUSE_FIELDS,
  createAssignedOutcomeQuery,
  createWarehouseAssignedOutcomeLoader,
  importAssignedOutcomeEvents,
  MetricReadService,
} from "@croco/metrics-core/runtime";
import type { AssignedOutcomeInput } from "@croco/metrics-core";
import type { WarehouseAccess, WarehouseQuality } from "@croco/warehouse-core/runtime";
import type { MetricReadQuality } from "@croco/metrics-core/runtime";
import { describe, expect, it } from "vitest";
import {
  installPostgresFactSchema,
  installPostgresWarehouseSchema,
  PostgresWarehouseCatalog,
  PostgresWarehouseReader,
  PostgresWarehouseWriter,
} from "../facts";

const enabled = process.env.CROCO_TEST_REAL_RESOURCES === "1";
describe.skipIf(!enabled)("Assigned outcomes through real PostgreSQL facts", () => {
  it("matches file and standalone outcomes with pinned paginated reads and rejects revocation", async () => {
    const started = await postgresResource({ id: "assigned-outcomes", mode: "commit" }).start({
      register: () => undefined,
      testId: "assigned-outcomes",
      workerId: "assigned-outcomes",
    });
    const connection = started.connection;
    const cancellationPool = new Pool({ connectionString: connection.connectionString, max: 1 });
    try {
      const at = "2026-01-02T00:00:00.000Z";
      const scope = { app: "outcomes", environment: "test", tenant: "tenant" };
      const sources = ["ledger", "engagement"];
      const window = { from: "2026-01-01T00:00:00.000Z", to: "2026-01-02T00:00:00.001Z" };
      const optional = new Set<string>([
        "subject",
        "relatedPaymentId",
        "correctionSource",
        "correctionEventId",
      ]);
      const descriptor = await compileFact(
        defineFact("assigned_outcome_events", {
          version: 1,
          kind: "transaction",
          scope: "tenant",
          grain: { description: "One source event", key: ["source", "eventId"] },
          columns: Object.fromEntries(
            ASSIGNED_OUTCOME_WAREHOUSE_FIELDS.map((name) => [
              name,
              name === "occurredAt" || name === "observedAt"
                ? c.instant({ precision: "millisecond" })
                : optional.has(name)
                  ? c.nullable(c.string())
                  : c.string(),
            ]),
          ),
          time: { event: "occurredAt" },
          write: { mode: "append", duplicate: "ignore-identical", conflict: "reject" },
        }),
      );
      await installPostgresWarehouseSchema(connection.pool);
      await installPostgresFactSchema(connection.pool, descriptor);
      let access: WarehouseAccess = {
        scope: { application: scope.app, environment: scope.environment, tenant: scope.tenant },
        actor: "operator",
        roles: ["read", "import", "publish", "drop"],
        columns: ASSIGNED_OUTCOME_WAREHOUSE_FIELDS,
        permissionEpoch: 0,
        privacyEpoch: 0,
      };
      const catalog = new PostgresWarehouseCatalog(connection.pool, descriptor, () => access);
      const writer = new PostgresWarehouseWriter(connection.pool, descriptor, () => access);
      const reader = new PostgresWarehouseReader(
        connection.pool,
        descriptor,
        () => access,
        "assigned-outcomes-cursor-secret-32bytes",
        cancellationPool,
      );
      const facts = [
        { arm: "control", kind: "payment", amount: "100000", id: "cp", related: null },
        { arm: "control", kind: "refund", amount: "20000", id: "cr", related: "cp" },
        { arm: "test", kind: "payment", amount: "110000", id: "tp", related: null },
        { arm: "test", kind: "refund", amount: "15000", id: "tr", related: "tp" },
        { arm: "test", kind: "cashback", amount: "20000", id: "tc", related: null },
        { arm: "test", kind: "direct_contact_cost", amount: "1000", id: "td", related: null },
      ]
        .map((item) => ({
          ...scope,
          source: item.kind === "direct_contact_cost" ? "engagement" : "ledger",
          eventId: item.id,
          subject: `${item.arm}-0`,
          kind: item.kind,
          amountMinor: item.amount,
          currency: "USD",
          occurredAt: at,
          observedAt: at,
          relatedPaymentId: item.related,
          valuationKind: "cash",
          correctionSource: null,
          correctionEventId: null,
        }))
        .sort((a, b) => a.source.localeCompare(b.source) || a.eventId.localeCompare(b.eventId));
      const candidate = await catalog.createCandidate({
        access,
        id: randomUUID(),
        transformHash: "outcome-mapping-v1",
        sourceRefs: sources,
        expectedHead: null,
        partitionSelection: null,
        audit: { reason: "test source mapping", expectedRevision: 0, idempotencyKey: randomUUID() },
      });
      await writer.write({
        access,
        candidateId: candidate.id,
        fence: candidate.fence,
        batchId: "batch",
        attempt: 1,
        rows: facts.map(({ app: _app, environment: _environment, tenant: _tenant, ...row }) =>
          validateRow(descriptor, row),
        ),
      });
      const sourceQuality: WarehouseQuality = {
        freshness: { observedAt: at, newestEventAt: at },
        temporalCompleteness: "complete",
        populationCoverage: "complete",
        validity: "valid",
        reproducibility: "reproducible",
        sourceCoverage: sources.map((sourceRef) => ({
          sourceRef,
          from: window.from,
          through: at,
          state: "complete" as const,
          gaps: [],
          late: false,
        })),
      };
      await catalog.sealCandidate({
        access,
        candidateId: candidate.id,
        fence: candidate.fence,
        expectedBatchIds: ["batch"],
        quality: sourceQuality,
        audit: { reason: "test coverage", expectedRevision: 0, idempotencyKey: randomUUID() },
      });
      const snapshot = await catalog.publishCandidate({
        access,
        candidateId: candidate.id,
        fence: candidate.fence,
        audit: { reason: "test publication", expectedRevision: 0, idempotencyKey: randomUUID() },
      });
      async function* bytes() {
        yield new TextEncoder().encode(facts.map((row) => JSON.stringify(row)).join("\n"));
      }
      const events = await importAssignedOutcomeEvents(bytes(), {
        format: "jsonl",
        scope,
        cutoff: { effectiveAt: at, knownAt: at },
        limits: { maxBytes: 10000, maxRecords: 10, maxRowBytes: 2000 },
      });
      const input: AssignedOutcomeInput = {
        assignmentSnapshot: {
          id: "assignment-v1",
          scope,
          unit: "person",
          arms: ["control", "test"],
          assignments: ["control", "test"].flatMap((arm) =>
            Array.from({ length: 100 }, (_, i) => ({ subject: `${arm}-${i}`, arm })),
          ),
        },
        events,
        cutoff: { effectiveAt: at, knownAt: at },
        revision: "1",
        metricDefinitionVersion: "assigned-net-v1",
        inputHash: "",
        definitionHash: await hashAssignedOutcomeDefinition(),
        currencies: ["USD"],
        sources,
        baselineArm: "control",
        retention: ["control", "test"].flatMap((arm) =>
          Array.from({ length: 100 }, (_, i) => ({ subject: `${arm}-${i}`, retained: true })),
        ),
        costCompleteness: ["control", "test"].flatMap((arm) =>
          sources.flatMap((source) =>
            (
              ["payment", "refund", "cashback", "direct_contact_cost", "noncash_grant"] as const
            ).map((kind) => ({ arm, source, kind, currency: "USD", status: "complete" as const })),
          ),
        ),
      };
      input.inputHash = await hashAssignedOutcomeInput(input);
      const limits = {
        maxRows: 100,
        maxBytes: 1000000,
        maxTimeMs: 30000,
        maxWindowMs: 172800000,
        maxConcurrency: 1,
        maxCost: 100,
      };
      const quality: MetricReadQuality = {
        temporalCompleteness: "complete",
        freshness: "fresh",
        populationCoverage: "complete",
        validity: "valid",
        exactness: "exact",
        reproducibility: "reproducible",
      };
      const load = createWarehouseAssignedOutcomeLoader({
        reader,
        access: () => access,
        snapshot,
        pageSize: 2,
        quality,
      });
      const registration = await createAssignedOutcomeQuery({
        id: "native-outcomes",
        sourceRefs: sources,
        limits,
        load,
      });
      const service = new MetricReadService([registration.definition], [registration.query], {
        currentContext: () => ({
          principal: { ...scope, subject: "operator" },
          allowedFields: ASSIGNED_OUTCOME_FIELDS,
          allowRaw: true,
          budget: limits,
          sourceRevisions: sources.map((sourceRef) => ({
            sourceRef,
            revision: String(snapshot.revision),
          })),
          snapshotRefs: sources.map(() => snapshot.id),
        }),
        authorize: async () => ({
          permissionEpoch: String(access.permissionEpoch),
          privacyEpoch: String(access.privacyEpoch),
        }),
      });
      const nativeInput = { ...input, events: [] };
      nativeInput.inputHash = await hashAssignedOutcomeInput(nativeInput);
      expect(nativeInput.inputHash).not.toBe(input.inputHash);
      const result = await service.runRegisteredQuery("native-outcomes", nativeInput, window);
      expect(result.status).toBe("verified");
      if (result.status === "verified")
        expect(result.result.data).toEqual(compareAssignedOutcomes(input));
      expect(compareAssignedOutcomes(input).byCurrency[0].delta[0].value).toEqual({
        numerator: "-60",
        denominator: "1",
      });
      access = { ...access, privacyEpoch: 1 };
      await expect(
        service.runRegisteredQuery("native-outcomes", nativeInput, window),
      ).rejects.toThrow();
    } finally {
      await cancellationPool.end();
      await started.dispose?.();
    }
  }, 180000);
});
