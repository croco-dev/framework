import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { postgresResource, type PostgresTestConnection } from "@croco/testing-resources";
import { c, compileFact, defineFact, validateRow } from "@croco/warehouse-core";
import {
  average,
  compileMetric,
  count,
  dateBucket,
  defineMetric,
  eq,
  evaluateMetric,
  exactDistinct,
  min,
  project,
  ratio,
  sum,
} from "@croco/metrics-core";
import type { MetricDefinition, MetricExpression, MetricFact } from "@croco/metrics-core";
import { MetricReadService } from "@croco/metrics-core/runtime";
import type { MetricReadContext, RegisteredMetricQuery } from "@croco/metrics-core/runtime";
import type { FactDescriptor } from "@croco/warehouse-core";
import type {
  WarehouseAccess,
  WarehouseQuality,
  WarehouseSnapshot,
} from "@croco/warehouse-core/runtime";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  installPostgresFactSchema,
  installPostgresWarehouseSchema,
  PostgresWarehouseCatalog,
  PostgresWarehouseReader,
  PostgresWarehouseWriter,
} from "../facts";
import { quoteIdentifier, scopeKey } from "../facts/schema";
import type { WarehousePostgresPool } from "../facts/client";

const fact = defineFact("native_metric_events", {
  version: 1,
  kind: "transaction",
  scope: "tenant",
  grain: { description: "Synthetic event", key: ["id"] },
  columns: {
    id: c.id(),
    day: c.date({ zone: "America/New_York" }),
    at: c.instant({ precision: "millisecond" }),
    amount: c.moneyMinor({ currency: "currency" }),
    currency: c.currencyCode(),
    clicks: c.int64(),
    impressions: c.int64(),
    latency: c.decimal({ precision: 24, scale: 12 }),
    customer: c.string(),
  },
  time: { event: "at" },
  write: { mode: "append", duplicate: "ignore-identical", conflict: "reject" },
});
const source = {
  name: fact.name,
  kind: "transaction",
  sourceRefs: ["synthetic"],
  columns: {
    id: { type: "id" },
    day: { type: "date", zone: "America/New_York" },
    at: { type: "instant" },
    amount: { type: "money", currency: "currency" },
    currency: { type: "currency" },
    clicks: { type: "int64" },
    impressions: { type: "int64" },
    latency: { type: "decimal", scale: 12 },
    customer: { type: "string" },
  },
} as const satisfies MetricFact;
const window = { from: "2026-03-08T00:00:00.000Z", to: "2026-03-10T00:00:00.000Z" };
const rows = [
  {
    id: "one",
    day: "2026-03-08",
    at: "2026-03-08T06:59:59.000Z",
    amount: "9007199254740993",
    currency: "USD",
    clicks: "2",
    impressions: "8",
    latency: "1.000000000000",
    customer: "shared",
  },
  {
    id: "two",
    day: "2026-03-08",
    at: "2026-03-08T07:00:00.000Z",
    amount: "7",
    currency: "USD",
    clicks: "1",
    impressions: "4",
    latency: "1.000000000001",
    customer: "shared",
  },
  {
    id: "three",
    day: "2026-03-09",
    at: "2026-03-09T04:00:00.000Z",
    amount: "3",
    currency: "EUR",
    clicks: "0",
    impressions: "0",
    latency: "1.000000000002",
    customer: "other",
  },
  {
    id: "excluded",
    day: "2026-03-10",
    at: window.to,
    amount: "100",
    currency: "USD",
    clicks: "100",
    impressions: "100",
    latency: "100.000000000000",
    customer: "excluded",
  },
];
const quality: WarehouseQuality = {
  freshness: { observedAt: window.to, newestEventAt: window.to },
  temporalCompleteness: "complete",
  populationCoverage: "complete",
  validity: "valid",
  reproducibility: "reproducible",
  sourceCoverage: [
    {
      sourceRef: "synthetic",
      from: window.from,
      through: window.to,
      state: "complete",
      gaps: [],
      late: false,
    },
  ],
};
const metric = (measure: MetricExpression, extra: Partial<MetricDefinition> = {}) =>
  defineMetric("native_metric", {
    version: 1,
    from: source,
    measure,
    time: project(source, "at"),
    unit: "events",
    population: "synthetic",
    ...extra,
  });
const cash = () =>
  metric(sum(project(source, "amount")), { groupByRequired: [project(source, "currency")] });

describe.skipIf(process.env.CROCO_TEST_REAL_RESOURCES !== "1")(
  "PostgreSQL native metric reads",
  () => {
    let connection: PostgresTestConnection;
    let readPool: Pool;
    let cancellationPool: Pool;
    let dispose: (() => Promise<void> | void) | undefined;
    let descriptor: FactDescriptor;
    beforeAll(async () => {
      const started = await postgresResource({ id: "native-metrics", mode: "commit" }).start({
        register: () => undefined,
        testId: "native-metrics",
        workerId: "native-metrics",
      });
      connection = started.connection;
      dispose = started.dispose;
      readPool = new Pool({ connectionString: connection.connectionString, max: 2 });
      cancellationPool = new Pool({ connectionString: connection.connectionString, max: 1 });
      descriptor = await compileFact(fact);
      await installPostgresWarehouseSchema(connection.pool);
      await installPostgresFactSchema(connection.pool, descriptor);
    }, 180000);
    afterAll(async () => {
      await readPool?.end();
      await cancellationPool?.end();
      await dispose?.();
    });

    async function fixture() {
      const access: WarehouseAccess = {
        scope: { application: "native", environment: "test", tenant: randomUUID() },
        actor: "reader",
        roles: ["read", "import", "publish"],
        columns: Object.keys(descriptor.columns),
        permissionEpoch: 0,
        privacyEpoch: 0,
      };
      const catalog = new PostgresWarehouseCatalog(connection.pool, descriptor, () => access);
      const writer = new PostgresWarehouseWriter(connection.pool, descriptor, () => access);
      const reader = (pool: WarehousePostgresPool = readPool, grant = access) =>
        new PostgresWarehouseReader(
          pool,
          descriptor,
          () => grant,
          "native-metric-secret-32-characters",
          cancellationPool,
        );
      async function publish(data: typeof rows, previous?: WarehouseSnapshot) {
        const audit = {
          reason: "Synthetic metric verification",
          expectedRevision: previous?.revision ?? 0,
          idempotencyKey: randomUUID(),
        };
        const candidate = await catalog.createCandidate({
          access,
          id: randomUUID(),
          transformHash: "synthetic-v1",
          sourceRefs: ["synthetic"],
          expectedHead: previous?.id ?? null,
          partitionSelection: null,
          audit,
        });
        await writer.write({
          access,
          candidateId: candidate.id,
          fence: candidate.fence,
          batchId: "batch",
          attempt: 1,
          rows: data.map((row) => validateRow(descriptor, row)),
        });
        await catalog.sealCandidate({
          access,
          candidateId: candidate.id,
          fence: candidate.fence,
          expectedBatchIds: ["batch"],
          quality,
          audit: { ...audit, idempotencyKey: randomUUID() },
        });
        return catalog.publishCandidate({
          access,
          candidateId: candidate.id,
          fence: candidate.fence,
          audit: { ...audit, idempotencyKey: randomUUID() },
        });
      }
      const snapshot = await publish(rows);
      const request = (definition: MetricDefinition = cash()) => ({
        access,
        snapshotId: snapshot.id,
        definition,
        window,
        maxRows: 20,
        maxBytes: 16384,
        timeoutMs: 5000,
      });
      return { access, snapshot, reader, request, publish };
    }

    it("matches the reference evaluator for exact sums, CTR, half-even averages, DST buckets and filtered distinct", async () => {
      const f = await fixture();
      const definitions = [
        cash(),
        metric(
          ratio({
            numerator: sum(project(source, "clicks")),
            denominator: sum(project(source, "impressions")),
            zeroDenominator: "null",
          }),
          { groupByRequired: [project(source, "currency")] },
        ),
        metric(average(sum(project(source, "latency")), count(project(source, "latency"))), {
          filter: eq(project(source, "currency"), "USD"),
        }),
        metric(exactDistinct(project(source, "customer")), {
          filter: eq(project(source, "currency"), "USD"),
          bucket: dateBucket("day", "America/New_York"),
        }),
      ];
      for (const definition of definitions) {
        const result = await f.reader().readMetric(f.request(definition));
        expect(result.data).toEqual(evaluateMetric(definition, rows, window));
        expect(result).toMatchObject({
          snapshot: { id: f.snapshot.id },
          permissionEpoch: 0,
          privacyEpoch: 0,
          exactness: "exact",
        });
      }
      expect((await f.reader().readMetric(f.request(definitions[2]))).data[0]?.value).toBe("1");
    });

    it("pins publication, isolates tenants, rejects denied fields and result bounds", async () => {
      const f = await fixture();
      const next = await f.publish([{ ...rows[0], id: "new", amount: "25" }], f.snapshot);
      expect((await f.reader().readMetric(f.request())).data).toEqual(
        evaluateMetric(cash(), rows, window),
      );
      expect(
        (await f.reader().readMetric({ ...f.request(), snapshotId: next.id })).data,
      ).not.toEqual(evaluateMetric(cash(), rows, window));
      const other = await fixture();
      await expect(
        other.reader().readMetric({ ...other.request(), snapshotId: f.snapshot.id }),
      ).rejects.toThrow();
      const denied = { ...f.access, columns: ["at", "currency"] };
      await expect(
        f.reader(readPool, denied).readMetric({ ...f.request(), access: denied }),
      ).rejects.toThrow();
      await expect(f.reader().readMetric({ ...f.request(), maxRows: 1 })).rejects.toThrow();
      await expect(f.reader().readMetric({ ...f.request(), maxBytes: 1 })).rejects.toThrow();
    });

    it("parameterizes injection text and rejects empty extrema and cast unsupported operations", async () => {
      const f = await fixture();
      const injection = "USD' OR true; SELECT pg_sleep(20); --";
      const filtered = metric(count(), { filter: eq(project(source, "customer"), injection) });
      expect((await f.reader().readMetric(f.request(filtered))).data).toEqual(
        evaluateMetric(filtered, rows, window),
      );
      const emptyMin = metric(min(project(source, "clicks")), {
        filter: eq(project(source, "customer"), injection),
      });
      await expect(f.reader().readMetric(f.request(emptyMin))).rejects.toThrow();
      const invalid = {
        ...cash(),
        measure: { kind: "raw-sql", sql: "SELECT 1" },
      } as unknown as MetricDefinition;
      await expect(f.reader().readMetric(f.request(invalid))).rejects.toThrow();
    });

    function instrument(onAggregate: (sql: string) => Promise<void>): WarehousePostgresPool {
      return {
        query: readPool.query.bind(readPool),
        connect: async () => {
          const db = await readPool.connect();
          return {
            release: db.release.bind(db),
            query: async <T>(sql: string, params?: unknown[]) => {
              if (sql.startsWith("WITH ")) await onAggregate(sql);
              return { rows: (await db.query(sql, params)).rows as T[] };
            },
          };
        },
      };
    }

    it.each(["permission_epoch", "privacy_epoch"])(
      "rejects a %s change during an aggregate",
      async (column) => {
        const f = await fixture();
        let changed = false;
        const pool = instrument(async () => {
          if (!changed) {
            changed = true;
            await connection.query(
              `UPDATE warehouse_heads SET ${column}=${column}+1 WHERE scope_key=$1 AND model_version=$2`,
              [scopeKey(f.access.scope), descriptor.semanticHash],
            );
          }
        });
        await expect(f.reader(pool).readMetric(f.request())).rejects.toThrow();
        expect(changed).toBe(true);
      },
    );

    it("rejects retention of a historical snapshot during the aggregate even when epochs stay unchanged", async () => {
      const f = await fixture();
      const head = await f.publish([{ ...rows[0], id: "next" }], f.snapshot);
      const drop = { ...f.access, roles: [...f.access.roles, "drop" as const] };
      const catalog = new PostgresWarehouseCatalog(connection.pool, descriptor, () => drop);
      const pool = instrument(async () => {
        const expired = await catalog.expireSnapshots({
          access: drop,
          before: new Date().toISOString(),
          audit: {
            reason: "Concurrent retention fixture",
            expectedRevision: head.revision,
            idempotencyKey: randomUUID(),
          },
        });
        expect(expired.expired).toBeGreaterThan(0);
      });
      await expect(f.reader(pool).readMetric(f.request())).rejects.toThrow(
        "WAREHOUSE_SNAPSHOT_UNAVAILABLE",
      );
    });

    it("keeps date grouping/filtering and month buckets canonical under a non-ISO DateStyle", async () => {
      const f = await fixture();
      const pool: WarehousePostgresPool = {
        query: readPool.query.bind(readPool),
        connect: async () => {
          const db = await readPool.connect();
          return {
            release: db.release.bind(db),
            query: async <T>(sql: string, params?: unknown[]) => {
              const result = await db.query(sql, params);
              if (sql === "BEGIN READ ONLY") await db.query("SET LOCAL DateStyle = 'SQL, DMY'");
              return { rows: result.rows as T[] };
            },
          };
        },
      };
      const dates = { from: "2026-03-08", to: "2026-03-10" };
      for (const literal of ["2026-03-08", "2026-3-8", "tomorrow"]) {
        const definition = metric(sum(project(source, "clicks")), {
          time: project(source, "day"),
          groupByRequired: [project(source, "day")],
          filter: eq(project(source, "day"), literal),
          bucket: dateBucket("month", "America/New_York"),
        });
        expect(
          (await f.reader(pool).readMetric({ ...f.request(definition), window: dates })).data,
        ).toEqual(evaluateMetric(definition, rows, dates));
      }
    });

    it("cancels executing PostgreSQL work and discards the connection", async () => {
      const f = await fixture();
      let entered: () => void = () => undefined;
      const executing = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const released = vi.fn();
      const pool: WarehousePostgresPool = {
        query: readPool.query.bind(readPool),
        connect: async () => {
          const db = await readPool.connect();
          return {
            release: (error) => {
              released(error);
              db.release(error);
            },
            query: async <T>(sql: string, params?: unknown[]) => {
              if (sql.startsWith("WITH ")) {
                const waiting = db.query("SELECT pg_sleep(20)");
                entered();
                await waiting;
              }
              return { rows: (await db.query(sql, params)).rows as T[] };
            },
          };
        },
      };
      const controller = new AbortController();
      const pending = f.reader(pool).readMetric({ ...f.request(), signal: controller.signal });
      await executing;
      controller.abort();
      await expect(pending).rejects.toThrow("WAREHOUSE_READ_CANCELLED");
      expect(released).toHaveBeenCalledExactlyOnceWith(true);
    });

    it("executes with a PostgreSQL SELECT-only role", async () => {
      const f = await fixture();
      const role = `metric_reader_${randomUUID().replaceAll("-", "")}`;
      await connection.query(`CREATE ROLE ${quoteIdentifier(role)}`);
      await connection.query(`GRANT USAGE ON SCHEMA public TO ${quoteIdentifier(role)}`);
      await connection.query(
        `GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${quoteIdentifier(role)}`,
      );
      const pool: WarehousePostgresPool = {
        query: readPool.query.bind(readPool),
        connect: async () => {
          const db = await readPool.connect();
          await db.query(`SET ROLE ${quoteIdentifier(role)}`);
          return { query: db.query.bind(db), release: () => db.release(true) };
        },
      };
      try {
        expect((await f.reader(pool).readMetric(f.request())).data).toEqual(
          evaluateMetric(cash(), rows, window),
        );
      } finally {
        await connection.query(`DROP OWNED BY ${quoteIdentifier(role)}`);
        await connection.query(`DROP ROLE ${quoteIdentifier(role)}`);
      }
    });

    it("runs the registered metric service against the same PostgreSQL native executor", async () => {
      const f = await fixture();
      const definition = cash();
      const identity = await compileMetric(definition);
      const requiredFields = ["amount", "currency", "at"];
      const tenant = f.access.scope.tenant;
      if (!tenant) throw new TypeError("Test fixture requires a tenant");
      const context: MetricReadContext = {
        principal: {
          app: f.access.scope.application,
          environment: f.access.scope.environment,
          tenant: tenant,
          subject: f.access.actor,
        },
        allowedFields: requiredFields,
        allowRaw: false,
        budget: {
          maxWindowMs: 172800000,
          maxRows: 20,
          maxBytes: 16384,
          maxTimeMs: 5000,
          maxConcurrency: 1,
          maxCost: 1,
        },
        sourceRevisions: [{ sourceRef: "synthetic", revision: f.snapshot.id }],
        snapshotRefs: [f.snapshot.id],
      };
      const registered = {
        ...identity,
        description: "Synthetic PostgreSQL metric",
        requiredFields,
        requiresRaw: false,
      };
      const query: RegisteredMetricQuery = {
        id: "native_cash",
        version: 1,
        definitionRefs: [identity.id],
        unit: identity.unit,
        population: identity.population,
        filter: "all",
        requiredFields,
        requiresRaw: false,
        limits: context.budget,
        inputSchema: { parse: (input) => input },
        outputSchema: { parse: (output) => output },
        inputKey: () => "all",
        readExecutor: async (execution) => {
          const result = await f.reader().readMetric({
            ...f.request(definition),
            snapshotId: execution.context.snapshotRefs[0],
            window: execution.window,
            maxRows: execution.context.budget.maxRows,
            maxBytes: execution.context.budget.maxBytes,
            timeoutMs: execution.context.budget.maxTimeMs,
            signal: execution.signal,
          });
          const snapshotQuality = result.snapshot.quality;
          if (
            snapshotQuality.temporalCompleteness === "unknown" ||
            snapshotQuality.populationCoverage === "unknown" ||
            snapshotQuality.validity === "unknown"
          )
            throw new Error("Synthetic snapshot quality is unknown");
          return {
            data: result.data,
            principal: execution.context.principal,
            definition: identity,
            unit: identity.unit,
            population: identity.population,
            filter: "all",
            fieldRefs: requiredFields,
            window: execution.window,
            sourceRevisions: execution.context.sourceRevisions,
            snapshotRefs: [result.snapshot.id],
            quality: {
              temporalCompleteness: snapshotQuality.temporalCompleteness,
              freshness: "fresh",
              populationCoverage: snapshotQuality.populationCoverage,
              validity: snapshotQuality.validity,
              exactness: result.exactness,
              reproducibility: result.snapshot.quality.reproducibility,
            },
            diagnostics: [],
            rows: result.data.length,
            bytes: Buffer.byteLength(JSON.stringify(result.data)),
            cost: 1,
          };
        },
      };
      const service = new MetricReadService(
        [registered],
        [query],
        {
          currentContext: () => context,
          authorize: async () => ({ permissionEpoch: "0", privacyEpoch: "0" }),
        },
        { readCandidates: async () => [], verify: async () => false },
      );
      const outcome = await service.runRegisteredQuery(query.id, {}, window);
      expect(outcome.status).toBe("verified");
      if (outcome.status !== "verified") throw new Error("Native metric was not verified");
      expect(outcome.source).toBe("executor");
      const result = outcome.result;
      expect(result.data).toEqual(evaluateMetric(definition, rows, window));
      expect(result.definition).toEqual(identity);
      expect(result.sourceRevisions).toEqual(context.sourceRevisions);
      expect(result.quality.exactness).toBe("exact");
    });
  },
);
