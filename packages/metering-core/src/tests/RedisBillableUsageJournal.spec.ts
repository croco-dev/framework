import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BillableUsageClaim, BillableUsageEvent } from "../libs/BillableUsageJournal";
import { RedisBillableUsageJournal } from "../libs/RedisBillableUsageJournal";
import type { RedisClient } from "../libs/RedisClient";

const EVENT: BillableUsageEvent = {
  eventId: "event-1",
  tenantId: "tenant-1",
  meterId: "ai.tokens",
  aggregation: "SUM",
  unit: "token",
  value: 42,
  dimensions: { model: "gpt-5" },
};

function storedEntry(entry: Record<string, unknown>): Record<string, unknown> {
  const { event, ...state } = entry;
  return { ...state, eventJson: JSON.stringify(event) };
}

describe("RedisBillableUsageJournal", () => {
  let redis!: RedisClient;
  let journal!: RedisBillableUsageJournal;

  beforeEach(() => {
    redis = {
      scriptKeyAccess: "multi-key",
      zadd: vi.fn(),
      zrangebyscore: vi.fn(),
      set: vi.fn(),
      eval: vi.fn(),
    };
    journal = new RedisBillableUsageJournal(redis);
  });

  it("atomically appends a deterministic envelope and its pending indexes", async () => {
    vi.mocked(redis.eval).mockImplementation(async (_script, _keys, args) => [1, args[1]] as never);

    const result = await journal.append(EVENT, new Date("2026-08-01T00:00:00.000Z"));

    expect(result).toMatchObject({
      outcome: "appended",
      entry: { event: EVENT, state: "pending" },
    });
    const [script, keys, args] = vi.mocked(redis.eval).mock.calls[0];
    expect(script).toContain("redis.call('TIME')");
    expect(keys).toHaveLength(2);
    expect(args).toHaveLength(3);
    expect(args[0]).toBe(
      '{"aggregation":"SUM","dimensions":{"model":"gpt-5"},"eventId":"event-1","meterId":"ai.tokens","tenantId":"tenant-1","unit":"token","value":42}',
    );
    expect(JSON.parse(String(args[1]))).toMatchObject({ eventJson: args[0] });
  });

  it("treats an identical Redis entry as duplicate success", async () => {
    vi.mocked(redis.eval).mockImplementation(async (_script, _keys, args) => [0, args[1]] as never);

    await expect(journal.append(EVENT)).resolves.toMatchObject({ outcome: "duplicate" });
  });

  it("rejects a conflicting event fingerprint", async () => {
    vi.mocked(redis.eval).mockResolvedValue([-1, "{}"]);

    await expect(journal.append(EVENT)).rejects.toMatchObject({
      code: "metering/transition-conflict",
    });
  });

  it("restores claim timestamps and persists acceptance before removing pending state", async () => {
    const claim = {
      event: EVENT,
      state: "delivering",
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
      retryCount: 0,
      ownerId: "worker-1",
      fencingToken: 7,
      leaseExpiresAt: "2026-08-01T00:01:00.000Z",
      eventFingerprint: "fingerprint",
    };
    const accepted = {
      ...claim,
      state: "accepted",
      ownerId: undefined,
      fencingToken: undefined,
      leaseExpiresAt: undefined,
      acceptedAt: "2026-08-01T00:00:10.000Z",
      updatedAt: "2026-08-01T00:00:10.000Z",
    };
    vi.mocked(redis.eval)
      .mockResolvedValueOnce([JSON.stringify(storedEntry(claim))])
      .mockResolvedValueOnce([1, "OK", JSON.stringify(storedEntry(accepted))]);

    const claimed = await journal.claimNext({
      ownerId: "worker-1",
      leaseDurationMs: 60_000,
      now: new Date("2026-08-01T00:00:00.000Z"),
    });
    const result = await journal.markAccepted(
      claimed as BillableUsageClaim,
      new Date("2026-08-01T00:00:10.000Z"),
    );

    expect(claimed?.leaseExpiresAt).toEqual(new Date("2026-08-01T00:01:00.000Z"));
    expect(result).toMatchObject({
      state: "accepted",
      acceptedAt: new Date("2026-08-01T00:00:10.000Z"),
    });
    const [claimScript, , claimArgs] = vi.mocked(redis.eval).mock.calls[0];
    expect(claimScript).toContain("redis.call('TIME')");
    expect(claimArgs).toHaveLength(3);
    expect(claimArgs).not.toContain("2026-08-01T00:00:00.000Z");

    const [transitionScript, transitionKeys] = vi.mocked(redis.eval).mock.calls[1];
    expect(transitionKeys).toHaveLength(5);
    expect(transitionScript).toContain("redis.call('TIME')");
    const setIndex = transitionScript.indexOf("redis.call('SET', KEYS[1], updated)");
    const removeIndex = transitionScript.indexOf("redis.call('ZREM', KEYS[2], ARGV[4])");
    expect(setIndex).toBeGreaterThanOrEqual(0);
    expect(removeIndex).toBeGreaterThanOrEqual(0);
    expect(setIndex).toBeLessThan(removeIndex);
  });

  it("exposes backlog, oldest age, retries, and terminal failures", async () => {
    vi.mocked(redis.eval).mockResolvedValue([3, 5_000, 4, 2]);

    await expect(journal.getDiagnostics(new Date("2026-08-01T00:00:05.000Z"))).resolves.toEqual({
      backlogCount: 3,
      oldestPendingAgeMs: 5_000,
      retryCount: 4,
      terminalFailureCount: 2,
    });
    const [script, keys, args] = vi.mocked(redis.eval).mock.calls[0];
    expect(script).toContain("redis.call('ZCARD', KEYS[1])");
    expect(keys).toHaveLength(3);
    expect(args).toEqual([]);
  });

  it("maps an empty backlog sentinel to a null oldest pending age", async () => {
    vi.mocked(redis.eval).mockResolvedValue([0, -1, 0, 0]);

    await expect(journal.getDiagnostics()).resolves.toEqual({
      backlogCount: 0,
      oldestPendingAgeMs: null,
      retryCount: 0,
      terminalFailureCount: 0,
    });
  });
});
