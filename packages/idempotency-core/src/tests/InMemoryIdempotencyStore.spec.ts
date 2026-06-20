import { describe, expect, it } from "vitest";
import {
  deriveIdempotencyKey,
  IdempotencyConflictProblem,
  IdempotencyReservationNotFoundProblem,
  IdempotencyReservationStateProblem,
  InMemoryIdempotencyStore,
} from "../index";

function createKey(options: {
  readonly key?: string;
  readonly fingerprint?: string;
  readonly tenantId?: string | null;
}) {
  return deriveIdempotencyKey({
    namespace: "store-test",
    tenantId: options.tenantId,
    source: {
      kind: "explicit",
      key: options.key ?? "operation-1",
      fingerprint: options.fingerprint ?? "payload-a",
    },
  });
}

describe("InMemoryIdempotencyStore", () => {
  it("replays a committed response for the same key and fingerprint", async () => {
    const store = new InMemoryIdempotencyStore<{ ok: true }>();
    const key = createKey({});

    const first = await store.reserve(key);
    expect(first.outcome).toBe("reserved");
    if (first.outcome !== "reserved") {
      throw new Error("expected a reservation");
    }

    await store.commit({
      key,
      reservationId: first.reservation.reservationId,
      response: { ok: true },
    });

    const second = await store.reserve(key);
    expect(second.outcome).toBe("replay");
    if (second.outcome === "replay") {
      expect(second.response).toEqual({ ok: true });
    }
  });

  it("returns a safe in-flight state while work is active", async () => {
    const store = new InMemoryIdempotencyStore();
    const key = createKey({});

    const first = await store.reserve(key);
    const second = await store.reserve(key);

    expect(first.outcome).toBe("reserved");
    expect(second.outcome).toBe("in-flight");
    if (first.outcome === "reserved" && second.outcome === "in-flight") {
      expect(second.record.reservationId).toBe(first.reservation.reservationId);
    }
  });

  it("fails key fingerprint conflicts with a standard Problem", async () => {
    const store = new InMemoryIdempotencyStore();
    const key = createKey({ key: "shared", fingerprint: "payload-a" });
    const conflictingKey = createKey({ key: "shared", fingerprint: "payload-b" });

    await store.reserve(key);

    await expect(store.reserve(conflictingKey)).rejects.toThrow(IdempotencyConflictProblem);
    await expect(store.reserve(conflictingKey)).rejects.toMatchObject({
      code: "idempotency-core/key-conflict",
      status: 409,
    });

    try {
      await store.reserve(conflictingKey);
    } catch (error) {
      expect(error).toBeInstanceOf(IdempotencyConflictProblem);
      if (error instanceof IdempotencyConflictProblem) {
        expect(error.toJSON()).toMatchObject({
          code: "idempotency-core/key-conflict",
          fingerprintMismatch: true,
        });
        expect(error.toJSON()).not.toHaveProperty("expectedFingerprint");
        expect(error.toJSON()).not.toHaveProperty("actualFingerprint");
      }
    }
  });

  it("allows the same key and different fingerprints in different tenant namespaces", async () => {
    const store = new InMemoryIdempotencyStore();
    const tenantAKey = createKey({ key: "shared", fingerprint: "payload-a", tenantId: "tenant-a" });
    const tenantBKey = createKey({ key: "shared", fingerprint: "payload-b", tenantId: "tenant-b" });

    const tenantA = await store.reserve(tenantAKey);
    const tenantB = await store.reserve(tenantBKey);

    expect(tenantA.outcome).toBe("reserved");
    expect(tenantB.outcome).toBe("reserved");
  });

  it("records failed attempts and allows retryable failures to reserve again", async () => {
    const store = new InMemoryIdempotencyStore();
    const key = createKey({});

    const first = await store.reserve(key);
    expect(first.outcome).toBe("reserved");
    if (first.outcome !== "reserved") {
      throw new Error("expected a reservation");
    }

    await store.fail({
      key,
      reservationId: first.reservation.reservationId,
      problem: { code: "transient", status: 503, detail: "try again" },
      retryable: true,
    });

    const retry = await store.reserve(key);
    expect(retry.outcome).toBe("reserved");
  });

  it("keeps non-retryable failure evidence visible to repeated calls", async () => {
    const store = new InMemoryIdempotencyStore();
    const key = createKey({});

    const first = await store.reserve(key);
    expect(first.outcome).toBe("reserved");
    if (first.outcome !== "reserved") {
      throw new Error("expected a reservation");
    }

    await store.fail({
      key,
      reservationId: first.reservation.reservationId,
      problem: { code: "permanent", status: 422, detail: "invalid request" },
      retryable: false,
    });

    const retry = await store.reserve(key);
    expect(retry.outcome).toBe("failed");
    if (retry.outcome === "failed") {
      expect(retry.record.problem).toEqual({
        code: "permanent",
        status: 422,
        detail: "invalid request",
      });
    }
  });

  it("expires records by ttl and manual expiration", async () => {
    let now = new Date("2026-01-01T00:00:00.000Z");
    const store = new InMemoryIdempotencyStore({ now: () => now });
    const key = createKey({});

    await store.reserve(key, { ttlMs: 100 });
    expect(store.size).toBe(1);

    now = new Date("2026-01-01T00:00:00.100Z");
    expect(store.size).toBe(0);

    const fresh = await store.reserve(key);
    expect(fresh.outcome).toBe("reserved");
    expect(await store.expire({ key })).toBe(true);
    expect(await store.replay(key)).toBeNull();
  });

  it("rejects missing or stale reservations when committing", async () => {
    const store = new InMemoryIdempotencyStore();
    const key = createKey({});

    await expect(
      store.commit({
        key,
        reservationId: "missing",
        response: "result",
      }),
    ).rejects.toThrow(IdempotencyReservationNotFoundProblem);

    const reserved = await store.reserve(key);
    expect(reserved.outcome).toBe("reserved");
    if (reserved.outcome !== "reserved") {
      throw new Error("expected a reservation");
    }

    await expect(
      store.commit({
        key,
        reservationId: "wrong",
        response: "result",
      }),
    ).rejects.toThrow(IdempotencyReservationStateProblem);
  });
});
