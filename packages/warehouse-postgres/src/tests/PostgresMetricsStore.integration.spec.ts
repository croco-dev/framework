import { postgresResource, type PostgresTestConnection } from "@croco/testing-resources";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { MRRMovement } from "@croco/metrics-core";
import {
  PostgresMetricsStore,
  installPostgresMetricsSchema,
  installTimescaleMetricsSchema,
  migrateLegacyMetricsSchema,
} from "../metrics";

const realResourcesEnabled = process.env.CROCO_TEST_REAL_RESOURCES === "1";
const timescaleImage =
  "timescale/timescaledb:2.18.2-pg17@sha256:a20e4b43186361d7bb48876e6c703437a10b7098909cb24d87a207c41097367b";

const movement: MRRMovement = {
  new: { amount: 1000, currency: "USD" },
  expansion: { amount: 0, currency: "USD" },
  contraction: { amount: 0, currency: "USD" },
  churned: { amount: 0, currency: "USD" },
  reactivation: { amount: 0, currency: "USD" },
  net: { amount: 1000, currency: "USD" },
};

describe.skipIf(!realResourcesEnabled).each(["PostgreSQL", "TimescaleDB"] as const)(
  "%s metrics persistence",
  (backend) => {
    let connection: PostgresTestConnection | undefined;
    let dispose: (() => Promise<void> | void) | undefined;

    beforeAll(async () => {
      const resource = postgresResource({
        id: `metrics-${backend}`,
        ...(backend === "TimescaleDB" ? { image: timescaleImage } : {}),
        mode: "commit",
      });
      const started = await resource.start({
        register: () => undefined,
        testId: "metrics-schema-and-dedupe",
        workerId: "warehouse-postgres",
      });
      connection = started.connection;
      dispose = started.dispose;
      if (backend === "TimescaleDB") {
        await installTimescaleMetricsSchema(connection.pool);
      } else {
        await installPostgresMetricsSchema(connection.pool);
      }
    }, 180_000);

    beforeEach(async () => {
      await connection?.query("TRUNCATE mrr_movements, mrr_movement_event_keys, metrics_snapshots");
    });

    afterAll(async () => {
      await dispose?.();
    });

    function stores(): readonly [PostgresMetricsStore, PostgresMetricsStore] {
      if (!connection) {
        throw new Error(`${backend} test resource did not start`);
      }

      return [new PostgresMetricsStore(connection.pool), new PostgresMetricsStore(connection.pool)];
    }

    async function expectConcurrentDeliveryKeys(
      leftKey: string,
      leftAliases: readonly string[],
      rightKey: string,
      rightAliases: readonly string[],
      expectedClaimedKeys: readonly string[],
    ): Promise<void> {
      if (!connection) {
        throw new Error(`${backend} test resource did not start`);
      }

      const leftConnection = await connection.pool.connect();
      const rightConnection = await connection.pool.connect();
      const left = new PostgresMetricsStore(leftConnection);
      const right = new PostgresMetricsStore(rightConnection);
      const leftTimestamp = new Date("2026-03-02T00:00:00.000Z");
      const rightTimestamp = new Date("2026-04-02T00:00:00.000Z");

      try {
        await Promise.all([
          left.recordMRRMovement("tenant-1", movement, leftTimestamp, leftKey, leftAliases),
          right.recordMRRMovement("tenant-1", movement, rightTimestamp, rightKey, rightAliases),
        ]);
      } finally {
        leftConnection.release();
        rightConnection.release();
      }

      const result = await connection?.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM mrr_movements WHERE tenant_id = 'tenant-1'",
      );
      expect(result?.rows).toEqual([{ count: "1" }]);
      const claims = await connection.query<{ event_key: string }>(
        "SELECT event_key FROM mrr_movement_event_keys WHERE tenant_id = 'tenant-1' ORDER BY event_key",
      );
      expect(claims.rows).toEqual(
        [...expectedClaimedKeys].sort().map((event_key) => ({ event_key })),
      );
    }

    it("preserves snapshot upsert behavior", async () => {
      const [store] = stores();
      const date = new Date("2026-03-01T00:00:00.000Z");

      await store.recordSnapshot(
        "tenant-1",
        { activeCustomers: 10, date, totalMRR: { amount: 1000, currency: "USD" } },
        date,
      );
      await store.recordSnapshot(
        "tenant-1",
        { activeCustomers: 12, date, totalMRR: { amount: 1200, currency: "USD" } },
        date,
      );

      await expect(store.getSnapshot("tenant-1", date)).resolves.toMatchObject({
        activeCustomers: 12,
        totalMRR: { amount: 1200, currency: "USD" },
      });
    });

    it("provisions only the selected database features", async () => {
      if (backend === "PostgreSQL") {
        const extensions = await connection?.query(
          "SELECT extname FROM pg_extension WHERE extname = 'timescaledb'",
        );
        expect(extensions?.rows).toEqual([]);
        return;
      }
      const hypertables = await connection?.query<{ hypertable_name: string }>(
        `SELECT hypertable_name FROM timescaledb_information.hypertables
       WHERE hypertable_name IN ('mrr_movements', 'metrics_snapshots') ORDER BY hypertable_name`,
      );
      expect(hypertables?.rows).toEqual([
        { hypertable_name: "metrics_snapshots" },
        { hypertable_name: "mrr_movements" },
      ]);
    });

    it.skipIf(backend !== "TimescaleDB")(
      "converts populated PostgreSQL tables to hypertables without data loss",
      async () => {
        if (!connection) {
          throw new Error("TimescaleDB test resource did not start");
        }

        const client = await connection.pool.connect();
        try {
          await client.query("CREATE SCHEMA metrics_timescale_upgrade");
          await client.query("SET search_path TO metrics_timescale_upgrade, public");
          await installPostgresMetricsSchema(client);

          const store = new PostgresMetricsStore(client);
          const date = new Date("2026-03-01T00:00:00.000Z");
          await store.recordMRRMovement("tenant-1", movement, date, "existing-event");
          await store.recordSnapshot(
            "tenant-1",
            { date, activeCustomers: 10, totalMRR: { amount: 1000, currency: "USD" } },
            date,
          );

          await installTimescaleMetricsSchema(client);
          await installTimescaleMetricsSchema(client);

          const hypertables = await client.query<{ hypertable_name: string }>(
            `SELECT hypertable_name FROM timescaledb_information.hypertables
           WHERE hypertable_schema = 'metrics_timescale_upgrade'
           ORDER BY hypertable_name`,
          );
          expect(hypertables.rows).toEqual([
            { hypertable_name: "metrics_snapshots" },
            { hypertable_name: "mrr_movements" },
          ]);
          const claims = await client.query<{ event_key: string }>(
            "SELECT event_key FROM mrr_movement_event_keys ORDER BY event_key",
          );
          expect(claims.rows).toEqual([{ event_key: "existing-event" }]);
          await expect(store.getSnapshot("tenant-1", date)).resolves.toMatchObject({
            activeCustomers: 10,
            totalMRR: { amount: 1000, currency: "USD" },
          });
          await expect(
            store.getMRRHistory("tenant-1", {
              from: date,
              to: new Date("2026-04-01T00:00:00.000Z"),
              granularity: "month",
            }),
          ).resolves.toEqual([movement]);
        } finally {
          await client.query("RESET search_path");
          await client.query("DROP SCHEMA IF EXISTS metrics_timescale_upgrade CASCADE");
          client.release();
        }
      },
    );

    it.skipIf(backend !== "PostgreSQL")("preserves caller transaction ownership", async () => {
      if (!connection) {
        throw new Error("PostgreSQL test resource did not start");
      }

      const client = await connection.pool.connect();
      try {
        await client.query("CREATE SCHEMA metrics_transaction_ownership");
        await client.query("SET search_path TO metrics_transaction_ownership, public");
        await client.query("BEGIN");
        await client.query("CREATE TABLE caller_marker (id INTEGER PRIMARY KEY)");
        await client.query("INSERT INTO caller_marker (id) VALUES (1)");
        await installPostgresMetricsSchema(client);
        await client.query("ROLLBACK");

        const relations = await client.query<{ marker: string | null; movements: string | null }>(
          `SELECT
             to_regclass('metrics_transaction_ownership.caller_marker')::text AS marker,
             to_regclass('metrics_transaction_ownership.mrr_movements')::text AS movements`,
        );
        expect(relations.rows).toEqual([{ marker: null, movements: null }]);
      } finally {
        await client.query("RESET search_path");
        await client.query("DROP SCHEMA IF EXISTS metrics_transaction_ownership CASCADE");
        client.release();
      }
    });

    it.skipIf(backend !== "PostgreSQL")("rolls back a failed standalone schema batch", async () => {
      if (!connection) {
        throw new Error("PostgreSQL test resource did not start");
      }

      const client = await connection.pool.connect();
      try {
        await client.query("CREATE SCHEMA metrics_failed_install");
        await client.query("SET search_path TO metrics_failed_install, public");
        await client.query(
          "CREATE VIEW metrics_snapshots AS SELECT 'occupied'::text AS incompatible_column",
        );

        await expect(installPostgresMetricsSchema(client)).rejects.toThrow();

        const relations = await client.query<{ movements: string | null }>(
          "SELECT to_regclass('metrics_failed_install.mrr_movements')::text AS movements",
        );
        expect(relations.rows).toEqual([{ movements: null }]);
      } finally {
        await client.query("RESET search_path");
        await client.query("DROP SCHEMA IF EXISTS metrics_failed_install CASCADE");
        client.release();
      }
    });

    it("deduplicates concurrent current-key deliveries across separate pool connections", async () => {
      await expectConcurrentDeliveryKeys("current", [], "current", [], ["current"]);
    });

    it("isolates snapshot upserts by tenant", async () => {
      const [store] = stores();
      const date = new Date("2026-03-01T00:00:00.000Z");
      for (const [tenant, amount] of [
        ["tenant-1", 1000],
        ["tenant-2", 2000],
      ] as const) {
        await store.recordSnapshot(
          tenant,
          { date, activeCustomers: amount / 100, totalMRR: { amount, currency: "USD" } },
          date,
        );
      }
      await store.recordSnapshot(
        "tenant-2",
        { date, activeCustomers: 30, totalMRR: { amount: 3000, currency: "USD" } },
        date,
      );
      await expect(store.getSnapshot("tenant-1", date)).resolves.toEqual({
        date: expect.any(Date),
        activeCustomers: 10,
        totalMRR: { amount: 1000, currency: "USD" },
      });
    });

    it("returns null when only another tenant has a snapshot", async () => {
      const [store] = stores();
      const date = new Date("2026-03-01T00:00:00.000Z");
      await store.recordSnapshot(
        "tenant-2",
        { date, activeCustomers: 10, totalMRR: { amount: 1000, currency: "USD" } },
        date,
      );
      await expect(store.getSnapshot("tenant-1", date)).resolves.toBeNull();
    });

    it("allows the same event key independently for each tenant", async () => {
      const [store] = stores();
      const timestamp = new Date("2026-03-02T00:00:00.000Z");
      await Promise.all(
        ["tenant-1", "tenant-2"].map((tenant) =>
          store.recordMRRMovement(tenant, movement, timestamp, "shared"),
        ),
      );
      const rows = await connection?.query(
        "SELECT tenant_id FROM mrr_movements ORDER BY tenant_id",
      );
      expect(rows?.rows).toEqual([{ tenant_id: "tenant-1" }, { tenant_id: "tenant-2" }]);
    });

    it("keeps repeated unkeyed movements", async () => {
      const [store] = stores();
      const timestamp = new Date("2026-03-02T00:00:00.000Z");
      await store.recordMRRMovement("tenant-1", movement, timestamp);
      await store.recordMRRMovement("tenant-1", movement, timestamp);
      const rows = await connection?.query("SELECT COUNT(*)::int AS count FROM mrr_movements");
      expect(rows?.rows).toEqual([{ count: 2 }]);
    });

    it("returns numeric history in chronological order within the tenant's half-open period", async () => {
      const [store] = stores();
      const second = {
        ...movement,
        new: { amount: 2000, currency: "USD" },
        net: { amount: 2000, currency: "USD" },
      };
      await store.recordMRRMovement("tenant-1", second, new Date("2026-03-02T00:00:00.000Z"));
      await store.recordMRRMovement("tenant-1", movement, new Date("2026-03-01T00:00:00.000Z"));
      await store.recordMRRMovement("tenant-1", movement, new Date("2026-02-28T23:59:59.999Z"));
      await store.recordMRRMovement("tenant-1", movement, new Date("2026-04-01T00:00:00.000Z"));
      await store.recordMRRMovement("tenant-2", second, new Date("2026-03-02T00:00:00.000Z"));
      await expect(
        store.getMRRHistory("tenant-1", {
          from: new Date("2026-03-01T00:00:00.000Z"),
          to: new Date("2026-04-01T00:00:00.000Z"),
          granularity: "month",
        }),
      ).resolves.toEqual([movement, second]);
    });

    it("calculates retention from the requested tenant's numeric database rows", async () => {
      const [store] = stores();
      const from = new Date("2026-03-01T00:00:00.000Z");
      const to = new Date("2026-04-01T00:00:00.000Z");
      const endDate = new Date("2026-03-31T00:00:00.000Z");
      await store.recordSnapshot(
        "tenant-1",
        { date: from, activeCustomers: 100, totalMRR: { amount: 100000, currency: "USD" } },
        from,
      );
      await store.recordSnapshot(
        "tenant-1",
        { date: endDate, activeCustomers: 95, totalMRR: { amount: 103000, currency: "USD" } },
        endDate,
      );
      await store.recordSnapshot(
        "tenant-2",
        { date: from, activeCustomers: 1, totalMRR: { amount: 1, currency: "USD" } },
        from,
      );
      const changes: MRRMovement = {
        new: { amount: 15000, currency: "USD" },
        expansion: { amount: 8000, currency: "USD" },
        contraction: { amount: 2000, currency: "USD" },
        churned: { amount: 3000, currency: "USD" },
        reactivation: { amount: 1000, currency: "USD" },
        net: { amount: 19000, currency: "USD" },
      };
      await store.recordMRRMovement("tenant-1", changes, from);
      await store.recordMRRMovement("tenant-2", changes, from);
      await expect(
        store.getRetentionMetrics("tenant-1", { from, to, granularity: "month" }),
      ).resolves.toEqual({
        logoChurn: 5,
        revenueChurn: 3,
        grr: 95,
        nrr: 103,
      });
    });

    it("returns neutral retention when the tenant has no baseline", async () => {
      const [store] = stores();
      await expect(
        store.getRetentionMetrics("tenant-1", {
          from: new Date("2026-03-01T00:00:00.000Z"),
          to: new Date("2026-04-01T00:00:00.000Z"),
          granularity: "month",
        }),
      ).resolves.toEqual({ logoChurn: 0, revenueChurn: 0, grr: 100, nrr: 100 });
    });

    it("deduplicates concurrent legacy-key deliveries across separate pool connections", async () => {
      await expectConcurrentDeliveryKeys("legacy", [], "legacy", [], ["legacy"]);
    });

    it("deduplicates concurrent current and legacy deliveries globally per tenant", async () => {
      await expectConcurrentDeliveryKeys(
        "current",
        ["legacy"],
        "legacy",
        [],
        ["current", "legacy"],
      );
    });

    it("claims reversed overlapping aliases without deadlocking", async () => {
      await expectConcurrentDeliveryKeys(
        "current",
        ["shared", "legacy"],
        "legacy",
        ["shared", "current"],
        ["current", "legacy", "shared"],
      );
    });

    it("prevents a post-migration current alias from duplicating a reconciled legacy row", async () => {
      if (!connection) {
        throw new Error(`${backend} test resource did not start`);
      }

      const [store] = stores();
      await connection.query(
        `INSERT INTO mrr_movements (
        tenant_id, event_key, timestamp,
        new_mrr_amount, new_mrr_currency,
        expansion_mrr_amount, expansion_mrr_currency,
        contraction_mrr_amount, contraction_mrr_currency,
        churned_mrr_amount, churned_mrr_currency,
        reactivation_mrr_amount, reactivation_mrr_currency,
        net_mrr_amount, net_mrr_currency
      ) VALUES (
        'tenant-1', 'legacy', '2026-03-02T00:00:00.000Z',
        1000, 'USD', 0, 'USD', 0, 'USD', 0, 'USD', 0, 'USD', 1000, 'USD'
      )`,
      );
      await connection.query(
        `INSERT INTO mrr_movement_event_keys (tenant_id, event_key)
       SELECT tenant_id, event_key FROM mrr_movements WHERE event_key IS NOT NULL
       ON CONFLICT (tenant_id, event_key) DO NOTHING`,
      );

      await store.recordMRRMovement(
        "tenant-1",
        movement,
        new Date("2026-04-02T00:00:00.000Z"),
        "current",
        ["legacy"],
      );

      const movements = await connection.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM mrr_movements WHERE tenant_id = 'tenant-1'",
      );
      expect(movements.rows).toEqual([{ count: "1" }]);
    });

    it("migrates legacy tables without losing snapshots or replaying historical movements", async () => {
      if (!connection) {
        throw new Error("PostgreSQL test resource did not start");
      }
      const [store] = stores();
      const date = new Date("2026-03-02T00:00:00.000Z");
      await store.recordMRRMovement("tenant-1", movement, date);
      await connection.query("UPDATE mrr_movements SET event_key = 'legacy'");
      await store.recordSnapshot(
        "tenant-1",
        { date, activeCustomers: 10, totalMRR: { amount: 1000, currency: "USD" } },
        date,
      );
      await connection.query("DROP TABLE mrr_movement_event_keys");
      if (backend === "PostgreSQL") {
        await connection.query(`
        ALTER TABLE mrr_movements DROP CONSTRAINT mrr_movements_pkey;
        ALTER TABLE mrr_movements ADD PRIMARY KEY (id);
        CREATE UNIQUE INDEX uq_mrr_movements_tenant_event_key ON mrr_movements (tenant_id, event_key);
        ALTER TABLE metrics_snapshots DROP CONSTRAINT metrics_snapshots_pkey;
        ALTER TABLE metrics_snapshots ADD PRIMARY KEY (id);
      `);
      }
      const client = await connection.pool.connect();
      try {
        await migrateLegacyMetricsSchema(client);
        await migrateLegacyMetricsSchema(client);
      } finally {
        client.release();
      }
      await store.recordMRRMovement(
        "tenant-1",
        movement,
        new Date("2026-04-02T00:00:00.000Z"),
        "current",
        ["legacy"],
      );
      await expect(
        store.getMRRHistory("tenant-1", {
          from: new Date("2026-03-01T00:00:00.000Z"),
          to: new Date("2026-05-01T00:00:00.000Z"),
          granularity: "month",
        }),
      ).resolves.toEqual([movement]);
      await expect(store.getSnapshot("tenant-1", date)).resolves.toMatchObject({
        activeCustomers: 10,
        totalMRR: { amount: 1000, currency: "USD" },
      });
    });
  },
);
