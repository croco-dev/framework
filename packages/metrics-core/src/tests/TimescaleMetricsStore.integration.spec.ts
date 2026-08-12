import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { postgresResource, type PostgresTestConnection } from "@croco/testing-resources";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { MRRMovement } from "../types";
import { TimescaleMetricsStore } from "../libs/stores/TimescaleMetricsStore";

const realResourcesEnabled = process.env.CROCO_TEST_REAL_RESOURCES === "1";
const timescaleImage =
  "timescale/timescaledb:2.18.2-pg17@sha256:a20e4b43186361d7bb48876e6c703437a10b7098909cb24d87a207c41097367b";

function documentedSchema(): string {
  const source = readFileSync(resolve("src/libs/interfaces/MetricsRepository.ts"), "utf8");
  const codeBlock =
    /\* \*\*TimescaleDB Schema \(Hypertable\)\*\*:[\s\S]*?\* ```sql\n([\s\S]*?)\n \* ```/.exec(
      source,
    )?.[1];
  if (!codeBlock) {
    throw new Error("MetricsRepository TimescaleDB schema documentation was not found");
  }

  return codeBlock.replace(/^ \* ?/gm, "");
}

const movement: MRRMovement = {
  new: { amount: 1000, currency: "USD" },
  expansion: { amount: 0, currency: "USD" },
  contraction: { amount: 0, currency: "USD" },
  churned: { amount: 0, currency: "USD" },
  reactivation: { amount: 0, currency: "USD" },
  net: { amount: 1000, currency: "USD" },
};

describe.skipIf(!realResourcesEnabled)("TimescaleMetricsStore real TimescaleDB", () => {
  let connection: PostgresTestConnection | undefined;
  let dispose: (() => Promise<void> | void) | undefined;

  beforeAll(async () => {
    const resource = postgresResource({
      id: "metrics-timescale",
      image: timescaleImage,
      mode: "commit",
    });
    const started = await resource.start({
      register: () => undefined,
      testId: "timescale-schema-and-dedupe",
      workerId: "metrics-core",
    });
    connection = started.connection;
    dispose = started.dispose;
    await connection.query(documentedSchema());
  }, 180_000);

  beforeEach(async () => {
    await connection?.query("TRUNCATE mrr_movements, mrr_movement_event_keys, metrics_snapshots");
  });

  afterAll(async () => {
    await dispose?.();
  });

  function stores(): readonly [TimescaleMetricsStore, TimescaleMetricsStore] {
    if (!connection) {
      throw new Error("TimescaleDB test resource did not start");
    }

    return [new TimescaleMetricsStore(connection.pool), new TimescaleMetricsStore(connection.pool)];
  }

  async function expectConcurrentDeliveryKeys(
    leftKey: string,
    leftAliases: readonly string[],
    rightKey: string,
    rightAliases: readonly string[],
    expectedClaimedKeys: readonly string[],
  ): Promise<void> {
    if (!connection) {
      throw new Error("TimescaleDB test resource did not start");
    }

    const leftConnection = await connection.pool.connect();
    const rightConnection = await connection.pool.connect();
    const left = new TimescaleMetricsStore(leftConnection);
    const right = new TimescaleMetricsStore(rightConnection);
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

  it("provisions both documented hypertables and preserves snapshot upsert behavior", async () => {
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
      totalMRR: { amount: "1200", currency: "USD" },
    });
    const hypertables = await connection?.query<{ hypertable_name: string }>(
      `SELECT hypertable_name FROM timescaledb_information.hypertables
       WHERE hypertable_name IN ('mrr_movements', 'metrics_snapshots') ORDER BY hypertable_name`,
    );
    expect(hypertables?.rows).toEqual([
      { hypertable_name: "metrics_snapshots" },
      { hypertable_name: "mrr_movements" },
    ]);
  });

  it("deduplicates concurrent current-key deliveries across separate pool connections", async () => {
    await expectConcurrentDeliveryKeys("current", [], "current", [], ["current"]);
  });

  it("deduplicates concurrent legacy-key deliveries across separate pool connections", async () => {
    await expectConcurrentDeliveryKeys("legacy", [], "legacy", [], ["legacy"]);
  });

  it("deduplicates concurrent current and legacy deliveries globally per tenant", async () => {
    await expectConcurrentDeliveryKeys("current", ["legacy"], "legacy", [], ["current", "legacy"]);
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
      throw new Error("TimescaleDB test resource did not start");
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
});
