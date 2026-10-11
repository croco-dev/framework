import { readFile } from "node:fs/promises";
import { describe, it, expect, vi } from "vitest";
import {
  collectBehaviorSource,
  importBehaviorSource,
  readBehaviorWarehouse,
  registerBehaviorQuery,
} from "../libs/BehaviorSources";
import { computePeriodicRetention, computeFrequencyDistribution } from "../libs/BehaviorMetrics";
import { MetricReadService } from "../libs/read/MetricReadService";
import type { BehaviorColumnBinding } from "../libs/BehaviorSources";
import type { BehaviorDefinition } from "../libs/BehaviorMetrics";
import type { MetricReadContext, MetricReadQuality } from "../libs/read/MetricReadService";
import type { SourceSchema } from "@croco/etl-core/source";
import type { WarehouseReadRequest, WarehouseReader } from "@croco/warehouse-core/runtime";

const scope = { appId: "reports", environment: "demo", tenantId: "tenant-a" };
const definition: BehaviorDefinition = {
  id: "report.saved",
  version: "1",
  subjectKind: "user",
  timezone: "UTC",
  actions: ["report.saved"],
  deletedSubjectPolicy: "include",
  historyStart: "2026-01-01T00:00:00Z",
};
const baseline = {
  kind: "calendar",
  from: "2026-09-07T00:00:00Z",
  to: "2026-09-14T00:00:00Z",
} as const;
const returning = { kind: "calendar", from: baseline.to, to: "2026-09-21T00:00:00Z" } as const;
const metadata = {
  definitionId: definition.id,
  version: definition.version,
  subjectKind: definition.subjectKind,
  timezone: definition.timezone,
  scope,
  completeThrough: returning.to,
  knownHistoryFrom: definition.historyStart,
  sourceRef: "snapshot-1",
};
const binding: BehaviorColumnBinding = {
  subjectId: "subjectId",
  source: "source",
  eventId: "eventId",
  occurredAt: "occurredAt",
  action: "action",
  appId: "appId",
  environment: "environment",
  tenantId: "tenantId",
};
const schema: SourceSchema = {
  format: "jsonl",
  encoding: "utf-8",
  fields: Object.values(binding).map((name) => ({ name, type: "string" })),
  limits: { maxBytes: 100000, maxRecords: 300, maxRowBytes: 1000 },
};
async function fixture() {
  return readFile(new URL("./fixtures/behavior-events.jsonl", import.meta.url), "utf8");
}
async function* bytes(text: string) {
  yield new TextEncoder().encode(text);
}
async function* records(rows: readonly Readonly<Record<string, unknown>>[]) {
  yield* rows;
}
const quality: MetricReadQuality = {
  freshness: "fresh",
  temporalCompleteness: "complete",
  populationCoverage: "complete",
  validity: "valid",
  exactness: "exact",
  reproducibility: "reproducible",
};
const limits = {
  maxRows: 300,
  maxBytes: 100000,
  maxTimeMs: 1000,
  maxConcurrency: 1,
  maxCost: 300,
  maxWindowMs: 300 * 86400000,
};
const context: MetricReadContext = {
  principal: {
    app: scope.appId,
    environment: scope.environment,
    tenant: scope.tenantId,
    subject: "operator",
  },
  allowedFields: ["action"],
  allowRaw: false,
  budget: limits,
  sourceRevisions: [{ sourceRef: "example", revision: "snapshot-1" }],
  snapshotRefs: ["snapshot-1"],
};
const request: WarehouseReadRequest = {
  access: {
    scope: { application: scope.appId, environment: scope.environment, tenant: scope.tenantId },
    actor: "operator",
    roles: ["read"],
    columns: Object.values(binding),
    permissionEpoch: 1,
    privacyEpoch: 2,
  },
  snapshotId: "snapshot-1",
  projection: Object.values(binding),
  filters: [],
  order: [{ column: "eventId", direction: "asc" }],
  maxRows: 50,
  maxBytes: 20000,
  timeoutMs: 1000,
};

describe("Behavior shared sources", () => {
  it("gives the same 40/100 and count3/day1 from normalized rows, CSV, JSONL and paged warehouse", async () => {
    const text = await fixture();
    const rows = text
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, string>);
    const normalized = await collectBehaviorSource(records(rows), binding, metadata, 300);
    const jsonl = await importBehaviorSource(bytes(text), schema, binding, metadata, 300);
    const keys = Object.values(binding);
    const csv =
      [keys.join(","), ...rows.map((row) => keys.map((key) => row[key]).join(","))].join("\n") +
      "\n";
    const importedCsv = await importBehaviorSource(
      bytes(csv),
      { ...schema, format: "csv", header: true },
      binding,
      metadata,
      300,
    );
    const reader: WarehouseReader = {
      read: vi.fn<WarehouseReader["read"]>(async (input) => {
        const offset = Number(input.cursor ?? 0);
        const end = Math.min(offset + input.maxRows, rows.length);
        return {
          snapshotId: request.snapshotId,
          rows: rows.slice(offset, end),
          nextCursor: end === rows.length ? null : String(end),
          permissionEpoch: 1,
          privacyEpoch: 2,
          exactness: "exact",
        };
      }),
    };
    const warehouse = await collectBehaviorSource(
      readBehaviorWarehouse(reader, request, { maxRows: 300, maxBytes: 100000, maxPages: 10 }),
      binding,
      metadata,
      300,
    );
    for (const dataset of [normalized, jsonl, importedCsv, warehouse]) {
      expect(computePeriodicRetention(definition, dataset, { baseline, returning })).toEqual(
        computePeriodicRetention(definition, normalized, { baseline, returning }),
      );
      expect(computePeriodicRetention(definition, dataset, { baseline, returning })).toMatchObject({
        numerator: 40,
        denominator: 100,
        value: 0.4,
        availability: "complete",
      });
      expect(
        computeFrequencyDistribution(definition, dataset, {
          window: returning,
          measure: "count",
        }).subjects.find((subject) => subject.subjectId === "new-0"),
      ).toMatchObject({ count: 3, activeDays: 1 });
    }
    expect(reader.read).toHaveBeenCalledTimes(5);
  });
  it("does not silently truncate, cross a scope, repeat a cursor or change snapshot epochs", async () => {
    const text = await fixture();
    await expect(importBehaviorSource(bytes(text), schema, binding, metadata, 1)).rejects.toThrow();
    const row = JSON.parse(text.split("\n")[0] ?? "{}") as Record<string, string>;
    await expect(
      collectBehaviorSource(records([{ ...row, tenantId: "other" }]), binding, metadata, 1),
    ).rejects.toThrow();
    const page = {
      snapshotId: request.snapshotId,
      rows: [row],
      nextCursor: "repeat",
      permissionEpoch: 1,
      privacyEpoch: 2,
      exactness: "exact" as const,
    };
    for (const badPage of [page, { ...page, privacyEpoch: 3 }, { ...page, snapshotId: "other" }]) {
      await expect(
        collectBehaviorSource(
          readBehaviorWarehouse({ read: async () => badPage }, request, {
            maxRows: 300,
            maxBytes: 100000,
            maxPages: 5,
          }),
          binding,
          metadata,
          300,
        ),
      ).rejects.toThrow();
    }
    await expect(
      importBehaviorSource(bytes(text), schema, binding, metadata, 300, AbortSignal.abort()),
    ).rejects.toThrow();
  });
  it("serves only aggregate registered results and propagates incomplete evidence, scope and revision failures", async () => {
    const dataset = await importBehaviorSource(
      bytes(await fixture()),
      schema,
      binding,
      metadata,
      300,
    );
    for (const completeThrough of [returning.to, baseline.to]) {
      const registration = await registerBehaviorQuery({
        definition,
        queryId: "weekly",
        queryVersion: 1,
        selection: { kind: "periodic", options: { baseline, returning } },
        scope,
        sourceRevisions: context.sourceRevisions,
        limits,
        requiredFields: ["action"],
        source: async () => ({ dataset: { ...dataset, completeThrough }, quality }),
      });
      const service = (value = context) =>
        new MetricReadService([registration.definition], [registration.query], {
          currentContext: () => value,
          authorize: async () => ({ permissionEpoch: "1", privacyEpoch: "2" }),
        });
      const result = await service().runRegisteredQuery("weekly", null, {
        from: new Date(definition.historyStart).toISOString(),
        to: new Date(returning.to).toISOString(),
      });
      expect(result.status).toBe(completeThrough === returning.to ? "verified" : "partial");
      expect(JSON.stringify(result)).not.toMatch(/subjectId|eventId|prior-0/);
      if (result.status === "verified")
        expect(result.result.data).toMatchObject({ numerator: 40, denominator: 100, value: 0.4 });
      await expect(
        service({
          ...context,
          principal: { ...context.principal, tenant: "other" },
        }).runRegisteredQuery("weekly", null, {
          from: new Date(definition.historyStart).toISOString(),
          to: new Date(returning.to).toISOString(),
        }),
      ).rejects.toThrow();
      await expect(
        service({
          ...context,
          sourceRevisions: [{ sourceRef: "example", revision: "other" }],
        }).runRegisteredQuery("weekly", null, {
          from: new Date(definition.historyStart).toISOString(),
          to: new Date(returning.to).toISOString(),
        }),
      ).rejects.toThrow();
    }
  });
});
