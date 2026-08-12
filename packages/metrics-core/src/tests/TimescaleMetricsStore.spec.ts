import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MetricsSnapshot, MRRMovement } from "../../src/types";
import { type PostgresClient, TimescaleMetricsStore } from "../libs/stores/TimescaleMetricsStore";

describe("TimescaleMetricsStore", () => {
  let db!: PostgresClient;
  let store!: TimescaleMetricsStore;

  const movement: MRRMovement = {
    new: { amount: 1000, currency: "USD" },
    expansion: { amount: 0, currency: "USD" },
    contraction: { amount: 0, currency: "USD" },
    churned: { amount: 0, currency: "USD" },
    reactivation: { amount: 0, currency: "USD" },
    net: { amount: 1000, currency: "USD" },
  };

  beforeEach(() => {
    db = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
    };
    store = new TimescaleMetricsStore(db);
  });

  it("should atomically claim an event key before inserting a movement", async () => {
    await store.recordMRRMovement(
      "tenant-1",
      movement,
      new Date("2026-03-02T00:00:00.000Z"),
      "event-key-1",
    );

    expect(db.query).toHaveBeenCalledTimes(1);
    const [sql, params] = vi.mocked(db.query).mock.calls[0] ?? [];

    expect(sql).toContain("event_key");
    expect(sql).toContain("INSERT INTO mrr_movement_event_keys");
    expect(sql).toContain("FROM claim");
    expect(params).toEqual([
      "tenant-1",
      "event-key-1",
      new Date("2026-03-02T00:00:00.000Z"),
      1000,
      "USD",
      0,
      "USD",
      0,
      "USD",
      0,
      "USD",
      0,
      "USD",
      1000,
      "USD",
      ["event-key-1"],
    ]);
  });

  it("should check compatibility event keys before inserting a new primary key", async () => {
    await store.recordMRRMovement(
      "tenant-1",
      movement,
      new Date("2026-03-02T00:00:00.000Z"),
      "event-key-v2",
      ["event-key-v1"],
    );

    expect(db.query).toHaveBeenCalledTimes(1);
    const [sql, params] = vi.mocked(db.query).mock.calls[0] ?? [];

    expect(sql).toContain("SELECT DISTINCT candidate.event_key");
    expect(sql).toContain("FROM unnest($16::text[])");
    expect(sql).toContain("ORDER BY candidate.event_key");
    expect(sql).toContain("ON CONFLICT (tenant_id, event_key) DO NOTHING");
    expect(params).toEqual([
      "tenant-1",
      "event-key-v2",
      new Date("2026-03-02T00:00:00.000Z"),
      1000,
      "USD",
      0,
      "USD",
      0,
      "USD",
      0,
      "USD",
      0,
      "USD",
      1000,
      "USD",
      ["event-key-v2", "event-key-v1"],
    ]);
  });

  it("should normalize repeated compatibility keys inside the atomic claim", async () => {
    await store.recordMRRMovement(
      "tenant-1",
      movement,
      new Date("2026-03-02T00:00:00.000Z"),
      "event-key-v2",
      ["event-key-v2", "event-key-v1", "event-key-v1"],
    );

    const [sql, params] = vi.mocked(db.query).mock.calls[0] ?? [];

    expect(sql).toContain("SELECT DISTINCT candidate.event_key");
    expect(params?.[15]).toEqual(["event-key-v2", "event-key-v2", "event-key-v1", "event-key-v1"]);
  });

  it("should keep legacy insert path when event key is omitted", async () => {
    await store.recordMRRMovement("tenant-1", movement, new Date("2026-03-02T00:00:00.000Z"));

    expect(db.query).toHaveBeenCalledTimes(1);
    const [sql, params] = vi.mocked(db.query).mock.calls[0] ?? [];

    expect(sql).not.toContain("event_key");
    expect(sql).not.toContain("ON CONFLICT");
    expect(params).toEqual([
      "tenant-1",
      new Date("2026-03-02T00:00:00.000Z"),
      1000,
      "USD",
      0,
      "USD",
      0,
      "USD",
      0,
      "USD",
      0,
      "USD",
      1000,
      "USD",
    ]);
  });

  it("should calculate retention metrics from snapshots and movement history", async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({
        rows: [
          {
            date: new Date("2026-03-01T00:00:00.000Z"),
            total_mrr_amount: 100000,
            total_mrr_currency: "USD",
            activeCustomers: 100,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            date: new Date("2026-03-31T00:00:00.000Z"),
            total_mrr_amount: 103000,
            total_mrr_currency: "USD",
            activeCustomers: 95,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            new_mrr_amount: 15000,
            new_mrr_currency: "USD",
            expansion_mrr_amount: 8000,
            expansion_mrr_currency: "USD",
            contraction_mrr_amount: 2000,
            contraction_mrr_currency: "USD",
            churned_mrr_amount: 3000,
            churned_mrr_currency: "USD",
            reactivation_mrr_amount: 1000,
            reactivation_mrr_currency: "USD",
            net_mrr_amount: 19000,
            net_mrr_currency: "USD",
          },
        ],
      });

    const period = {
      from: new Date("2026-03-01T00:00:00.000Z"),
      to: new Date("2026-04-01T00:00:00.000Z"),
      granularity: "month" as const,
    };

    const result = await store.getRetentionMetrics("tenant-1", period);

    expect(result).toEqual({
      logoChurn: 5,
      revenueChurn: 3,
      grr: 95,
      nrr: 103,
    });
  });

  it("should fall back to neutral retention values when baseline snapshot is missing", async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const period = {
      from: new Date("2026-03-01T00:00:00.000Z"),
      to: new Date("2026-04-01T00:00:00.000Z"),
      granularity: "month" as const,
    };

    const result = await store.getRetentionMetrics("tenant-1", period);

    expect(result).toEqual({
      logoChurn: 0,
      revenueChurn: 0,
      grr: 100,
      nrr: 100,
    });
  });
});
