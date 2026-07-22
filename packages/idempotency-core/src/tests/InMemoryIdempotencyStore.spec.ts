import { describe, expect, it, vi } from "vitest";
import {
  deriveIdempotencyKey,
  IdempotencyConflictProblem,
  IdempotencyReservationExpiredProblem,
  IdempotencyReservationNotFoundProblem,
  IdempotencyReservationStateProblem,
  InMemoryIdempotencyStore,
  InvalidIdempotencyTtlProblem,
} from "../index";

const INVALID_TTL_CASES = [
  { label: "negative", ttlMs: -1, constraint: "positive-safe-integer", receivedValue: -1 },
  { label: "zero", ttlMs: 0, constraint: "positive-safe-integer", receivedValue: 0 },
  { label: "fractional", ttlMs: 1.5, constraint: "positive-safe-integer", receivedValue: 1.5 },
  { label: "NaN", ttlMs: Number.NaN, constraint: "positive-safe-integer", receivedValue: "NaN" },
  {
    label: "positive infinity",
    ttlMs: Number.POSITIVE_INFINITY,
    constraint: "positive-safe-integer",
    receivedValue: "Infinity",
  },
  {
    label: "negative infinity",
    ttlMs: Number.NEGATIVE_INFINITY,
    constraint: "positive-safe-integer",
    receivedValue: "-Infinity",
  },
  {
    label: "unsafe integer",
    ttlMs: Number.MAX_SAFE_INTEGER + 1,
    constraint: "positive-safe-integer",
    receivedValue: Number.MAX_SAFE_INTEGER + 1,
  },
  {
    label: "date overflow",
    ttlMs: 8_640_000_000_000_000,
    constraint: "valid-date-range",
    receivedValue: 8_640_000_000_000_000,
  },
] as const;

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
  it.each(INVALID_TTL_CASES)(
    "rejects $label ttl before reserving or consuming a reservation id",
    async ({ ttlMs, constraint, receivedValue }) => {
      const store = new InMemoryIdempotencyStore({
        now: () => new Date("2026-01-01T00:00:00.000Z"),
      });
      const key = createKey({});

      const error = await store.reserve(key, { ttlMs }).catch((cause: unknown) => cause);

      expect(error).toBeInstanceOf(InvalidIdempotencyTtlProblem);
      expect(error).toMatchObject({
        code: "idempotency-core/invalid-ttl",
        status: 400,
      });
      if (error instanceof InvalidIdempotencyTtlProblem) {
        expect(error.toJSON()).toMatchObject({
          code: "idempotency-core/invalid-ttl",
          field: "ttlMs",
          constraint,
          receivedValue,
        });
        expect(error.toJSON()).not.toHaveProperty("key");
        expect(error.toJSON()).not.toHaveProperty("storageKey");
        expect(error.toJSON()).not.toHaveProperty("reservationId");
      }
      expect(store.size).toBe(0);

      const valid = await store.reserve(key, { ttlMs: 1 });
      expect(valid.outcome).toBe("reserved");
      if (valid.outcome === "reserved") {
        expect(valid.reservation.reservationId).toBe("reservation-1");
      }
    },
  );

  it("rejects invalid ttl before pruning unrelated expired state", async () => {
    let now = new Date("2026-01-01T00:00:00.000Z");
    const store = new InMemoryIdempotencyStore<string>({ now: () => now });
    const staleKey = createKey({ key: "stale" });
    const stale = await store.reserve(staleKey, { ttlMs: 1 });
    expect(stale.outcome).toBe("reserved");
    if (stale.outcome !== "reserved") {
      throw new Error("expected a reservation");
    }

    now = new Date("2026-01-01T00:00:00.001Z");
    const invalidKey = createKey({ key: "invalid" });
    await expect(store.reserve(invalidKey, { ttlMs: 0 })).rejects.toBeInstanceOf(
      InvalidIdempotencyTtlProblem,
    );

    await expect(
      store.commit({
        key: staleKey,
        reservationId: stale.reservation.reservationId,
        response: "stale",
      }),
    ).rejects.toBeInstanceOf(IdempotencyReservationExpiredProblem);
  });

  describe.each(["commit", "fail"] as const)("%s ttl validation", (transition) => {
    it.each(INVALID_TTL_CASES)(
      "rejects $label ttl without changing the active reservation",
      async ({ ttlMs }) => {
        const store = new InMemoryIdempotencyStore<string>({
          now: () => new Date("2026-01-01T00:00:00.000Z"),
        });
        const key = createKey({ key: `${transition}-${String(ttlMs)}` });
        const reserved = await store.reserve(key);
        expect(reserved.outcome).toBe("reserved");
        if (reserved.outcome !== "reserved") {
          throw new Error("expected a reservation");
        }

        const operation =
          transition === "commit"
            ? store.commit({
                key,
                reservationId: reserved.reservation.reservationId,
                response: "created",
                ttlMs,
              })
            : store.fail({
                key,
                reservationId: reserved.reservation.reservationId,
                problem: { code: "failed" },
                ttlMs,
              });

        await expect(operation).rejects.toBeInstanceOf(InvalidIdempotencyTtlProblem);

        const unchanged = await store.reserve(key);
        expect(unchanged.outcome).toBe("in-flight");
        if (unchanged.outcome === "in-flight") {
          expect(unchanged.record.reservationId).toBe(reserved.reservation.reservationId);
        }
      },
    );
  });

  it("keeps an omitted ttl explicitly non-expiring", async () => {
    let now = new Date("2026-01-01T00:00:00.000Z");
    const store = new InMemoryIdempotencyStore({ now: () => now });
    const key = createKey({ key: "non-expiring" });

    const reserved = await store.reserve(key);
    expect(reserved.outcome).toBe("reserved");
    if (reserved.outcome !== "reserved") {
      throw new Error("expected a reservation");
    }
    expect(reserved.record.expiresAt).toBeNull();

    now = new Date("2126-01-01T00:00:00.000Z");
    const stillActive = await store.reserve(key);
    expect(stillActive.outcome).toBe("in-flight");
    expect(store.size).toBe(1);
  });

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

  it.each([
    { transition: "commit" as const, observedAt: "2026-01-01T00:00:00.100Z" },
    { transition: "commit" as const, observedAt: "2026-01-01T00:00:00.101Z" },
    { transition: "fail" as const, observedAt: "2026-01-01T00:00:00.100Z" },
    { transition: "fail" as const, observedAt: "2026-01-01T00:00:00.101Z" },
  ])("rejects $transition at or after reservation expiry", async ({ transition, observedAt }) => {
    let now = new Date("2026-01-01T00:00:00.000Z");
    const clock = vi.fn(() => now);
    const store = new InMemoryIdempotencyStore({ now: clock });
    const key = createKey({});
    const reserved = await store.reserve(key, { ttlMs: 100 });
    expect(reserved.outcome).toBe("reserved");
    if (reserved.outcome !== "reserved") {
      throw new Error("expected a reservation");
    }

    now = new Date(observedAt);
    clock.mockClear();
    const operation = () =>
      transition === "commit"
        ? store.commit({
            key,
            reservationId: reserved.reservation.reservationId,
            response: "stale-result",
          })
        : store.fail({
            key,
            reservationId: reserved.reservation.reservationId,
            problem: { code: "stale-failure", status: 500 },
          });

    const error = await operation().catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(IdempotencyReservationExpiredProblem);
    expect(error).toMatchObject({
      code: "idempotency-core/reservation-expired",
      status: 409,
    });
    expect(clock).toHaveBeenCalledTimes(1);

    if (error instanceof IdempotencyReservationExpiredProblem) {
      expect(error.toJSON()).toMatchObject({
        code: "idempotency-core/reservation-expired",
        expiredAt: "2026-01-01T00:00:00.100Z",
        observedAt,
      });
      expect(error.toJSON()).not.toHaveProperty("key");
      expect(error.toJSON()).not.toHaveProperty("storageKey");
      expect(error.toJSON()).not.toHaveProperty("fingerprint");
      expect(error.toJSON()).not.toHaveProperty("reservationId");
    }
  });

  it.each(["commit", "fail"] as const)(
    "allows %s immediately before reservation expiry with one clock read",
    async (transition) => {
      let now = new Date("2026-01-01T00:00:00.000Z");
      const clock = vi.fn(() => now);
      const store = new InMemoryIdempotencyStore({ now: clock });
      const key = createKey({ key: transition });
      const reserved = await store.reserve(key, { ttlMs: 100 });
      expect(reserved.outcome).toBe("reserved");
      if (reserved.outcome !== "reserved") {
        throw new Error("expected a reservation");
      }

      now = new Date("2026-01-01T00:00:00.099Z");
      clock.mockClear();
      if (transition === "commit") {
        const completed = await store.commit({
          key,
          reservationId: reserved.reservation.reservationId,
          response: "result",
        });
        expect(completed.completedAt).toEqual(now);
      } else {
        const failed = await store.fail({
          key,
          reservationId: reserved.reservation.reservationId,
          problem: { code: "expected-failure", status: 500 },
        });
        expect(failed.failedAt).toEqual(now);
      }
      expect(clock).toHaveBeenCalledTimes(1);
    },
  );

  it("keeps non-expiring reservations compatible with commit and fail", async () => {
    const store = new InMemoryIdempotencyStore();
    const commitKey = createKey({ key: "commit-without-ttl" });
    const failKey = createKey({ key: "fail-without-ttl" });
    const committedReservation = await store.reserve(commitKey);
    const failedReservation = await store.reserve(failKey);
    if (committedReservation.outcome !== "reserved" || failedReservation.outcome !== "reserved") {
      throw new Error("expected reservations");
    }

    await expect(
      store.commit({
        key: commitKey,
        reservationId: committedReservation.reservation.reservationId,
        response: "result",
      }),
    ).resolves.toMatchObject({ status: "completed" });
    await expect(
      store.fail({
        key: failKey,
        reservationId: failedReservation.reservation.reservationId,
        problem: { code: "expected-failure", status: 500 },
      }),
    ).resolves.toMatchObject({ status: "failed" });
  });

  it("preserves validation precedence for expired records", async () => {
    let now = new Date("2026-01-01T00:00:00.000Z");
    const store = new InMemoryIdempotencyStore({ now: () => now });
    const key = createKey({ key: "precedence", fingerprint: "payload-a" });
    const conflictingKey = createKey({ key: "precedence", fingerprint: "payload-b" });
    const reserved = await store.reserve(key, { ttlMs: 100 });
    if (reserved.outcome !== "reserved") {
      throw new Error("expected a reservation");
    }
    now = new Date("2026-01-01T00:00:00.100Z");

    await expect(
      store.commit({
        key: conflictingKey,
        reservationId: reserved.reservation.reservationId,
        response: "result",
      }),
    ).rejects.toBeInstanceOf(IdempotencyConflictProblem);
    await expect(
      store.commit({ key, reservationId: "wrong", response: "result" }),
    ).rejects.toBeInstanceOf(IdempotencyReservationStateProblem);

    const completedKey = createKey({ key: "completed-precedence" });
    now = new Date("2026-01-01T00:00:01.000Z");
    const completedReservation = await store.reserve(completedKey);
    if (completedReservation.outcome !== "reserved") {
      throw new Error("expected a reservation");
    }
    await store.commit({
      key: completedKey,
      reservationId: completedReservation.reservation.reservationId,
      response: "result",
      ttlMs: 100,
    });
    now = new Date("2026-01-01T00:00:01.100Z");
    await expect(
      store.commit({
        key: completedKey,
        reservationId: completedReservation.reservation.reservationId,
        response: "late-result",
      }),
    ).rejects.toBeInstanceOf(IdempotencyReservationStateProblem);
  });

  it("keeps expired evidence until reserve replaces it and rejects the stale owner", async () => {
    let now = new Date("2026-01-01T00:00:00.000Z");
    const store = new InMemoryIdempotencyStore({ now: () => now });
    const key = createKey({ key: "replacement" });
    const stale = await store.reserve(key, { ttlMs: 100 });
    if (stale.outcome !== "reserved") {
      throw new Error("expected a reservation");
    }
    now = new Date("2026-01-01T00:00:00.100Z");

    const staleCommit = () =>
      store.commit({
        key,
        reservationId: stale.reservation.reservationId,
        response: "stale-result",
      });
    await expect(staleCommit()).rejects.toBeInstanceOf(IdempotencyReservationExpiredProblem);
    await expect(staleCommit()).rejects.toBeInstanceOf(IdempotencyReservationExpiredProblem);

    const fresh = await store.reserve(key, { ttlMs: 100 });
    expect(fresh.outcome).toBe("reserved");
    if (fresh.outcome !== "reserved") {
      throw new Error("expected a fresh reservation");
    }
    expect(fresh.reservation.reservationId).not.toBe(stale.reservation.reservationId);

    await expect(staleCommit()).rejects.toBeInstanceOf(IdempotencyReservationStateProblem);
    await expect(
      store.fail({
        key,
        reservationId: stale.reservation.reservationId,
        problem: { code: "stale-failure", status: 500 },
      }),
    ).rejects.toBeInstanceOf(IdempotencyReservationStateProblem);
    await expect(
      store.commit({
        key,
        reservationId: fresh.reservation.reservationId,
        response: "fresh-result",
      }),
    ).resolves.toMatchObject({ status: "completed", response: "fresh-result" });
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
