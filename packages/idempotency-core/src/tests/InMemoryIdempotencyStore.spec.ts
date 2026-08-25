import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import {
  deriveIdempotencyKey,
  IdempotencyConflictProblem,
  IdempotencyReservationExpiredProblem,
  IdempotencyReservationNotFoundProblem,
  IdempotencyReservationStateProblem,
  InMemoryIdempotencyStore,
  InvalidIdempotencySnapshotProblem,
  InvalidIdempotencyTtlProblem,
} from "../index";

type Float16ArrayLike = ArrayBufferView & {
  readonly length: number;
  [index: number]: number;
};

type Float16ArrayConstructorLike = new (values: ArrayLike<number>) => Float16ArrayLike;

const FLOAT16_ARRAY_CONSTRUCTOR = getFloat16ArrayConstructor();

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

function getFloat16ArrayConstructor(): Float16ArrayConstructorLike | null {
  const constructor = Reflect.get(globalThis, "Float16Array");
  return typeof constructor === "function"
    ? (constructor as unknown as Float16ArrayConstructorLike)
    : null;
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

  it("snapshots nested response and metadata values across commit and replay boundaries", async () => {
    const store = new InMemoryIdempotencyStore<{
      order: { id: string };
      items: string[];
      processedAt: Date;
    }>();
    const key = createKey({ key: "snapshot" });
    const reservedMetadata = {
      request: { tags: ["original"] },
      receivedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    const reserved = await store.reserve(key, { metadata: reservedMetadata });
    if (reserved.outcome !== "reserved") {
      throw new Error("expected a reservation");
    }

    const response = {
      order: { id: "original" },
      items: ["first"],
      processedAt: new Date("2026-01-02T00:00:00.000Z"),
    };
    const commitMetadata = {
      completion: { state: "original" },
      completedOn: new Date("2026-01-03T00:00:00.000Z"),
    };
    const committed = await store.commit({
      key,
      reservationId: reserved.reservation.reservationId,
      response,
      metadata: commitMetadata,
    });

    response.order.id = "mutated-after-commit";
    response.items.push("mutated-after-commit");
    response.processedAt.setUTCFullYear(2030);
    reservedMetadata.request.tags.push("mutated-after-reserve");
    reservedMetadata.receivedAt.setUTCFullYear(2030);
    commitMetadata.completion.state = "mutated-after-commit";
    commitMetadata.completedOn.setUTCFullYear(2030);
    committed.response.order.id = "mutated-commit-result";
    committed.response.items.push("mutated-commit-result");
    committed.response.processedAt.setUTCFullYear(2031);
    (committed.metadata.request as { tags: string[] }).tags.push("mutated-commit-result");
    (committed.metadata.completion as { state: string }).state = "mutated-commit-result";
    (committed.metadata.completedOn as Date).setUTCFullYear(2031);

    const firstReplay = await store.reserve(key);
    expect(firstReplay.outcome).toBe("replay");
    if (firstReplay.outcome !== "replay") {
      throw new Error("expected a replay");
    }
    expect(firstReplay.response).toEqual({
      order: { id: "original" },
      items: ["first"],
      processedAt: new Date("2026-01-02T00:00:00.000Z"),
    });
    expect(firstReplay.record.metadata).toEqual({
      request: { tags: ["original"] },
      receivedAt: new Date("2026-01-01T00:00:00.000Z"),
      completion: { state: "original" },
      completedOn: new Date("2026-01-03T00:00:00.000Z"),
    });
    expect(firstReplay.response.processedAt).toBeInstanceOf(Date);
    expect(firstReplay.record.metadata.receivedAt).toBeInstanceOf(Date);

    firstReplay.response.order.id = "mutated-replay-result";
    firstReplay.response.items.push("mutated-replay-result");
    firstReplay.response.processedAt.setUTCFullYear(2032);
    (firstReplay.record.metadata.request as { tags: string[] }).tags.push("mutated-replay-result");

    const directReplay = await store.replay(key);
    expect(directReplay).toMatchObject({
      response: {
        order: { id: "original" },
        items: ["first"],
        processedAt: new Date("2026-01-02T00:00:00.000Z"),
      },
      metadata: {
        request: { tags: ["original"] },
      },
    });
    if (directReplay === null) {
      throw new Error("expected a direct replay");
    }
    directReplay.response.order.id = "mutated-direct-replay";
    (directReplay.metadata.request as { tags: string[] }).tags.push("mutated-direct-replay");

    await expect(store.replay(key)).resolves.toMatchObject({
      response: { order: { id: "original" }, items: ["first"] },
      metadata: { request: { tags: ["original"] } },
    });
  });

  it("avoids redundant payload validation and cloning across commit and fail returns", async () => {
    const originalStructuredClone = structuredClone;
    const clone = vi.fn((value: unknown) => originalStructuredClone(value));
    vi.stubGlobal("structuredClone", clone);

    try {
      const committedStore = new InMemoryIdempotencyStore<{ nested: { value: string } }>();
      const committedKey = createKey({ key: "commit-clone-count" });
      const committedReservation = await committedStore.reserve(committedKey);
      if (committedReservation.outcome !== "reserved") {
        throw new Error("expected a reservation");
      }

      clone.mockClear();
      const committed = await committedStore.commit({
        key: committedKey,
        reservationId: committedReservation.reservation.reservationId,
        response: { nested: { value: "original" } },
        metadata: { attempt: 1 },
      });
      expect(clone).toHaveBeenCalledTimes(3);
      committed.response.nested.value = "mutated-result";
      await expect(committedStore.replay(committedKey)).resolves.toMatchObject({
        response: { nested: { value: "original" } },
      });

      const failedStore = new InMemoryIdempotencyStore();
      const failedKey = createKey({ key: "fail-clone-count" });
      const failedReservation = await failedStore.reserve(failedKey);
      if (failedReservation.outcome !== "reserved") {
        throw new Error("expected a reservation");
      }

      clone.mockClear();
      const failed = await failedStore.fail({
        key: failedKey,
        reservationId: failedReservation.reservation.reservationId,
        metadata: { attempt: 1 },
        problem: { code: "failed", detail: "original" },
        retryable: false,
      });
      expect(clone).toHaveBeenCalledTimes(3);
      if (failed.problem !== undefined) {
        (failed.problem as { detail: string }).detail = "mutated-result";
      }
      const repeated = await failedStore.reserve(failedKey);
      expect(repeated).toMatchObject({
        outcome: "failed",
        record: { problem: { code: "failed", detail: "original" } },
      });
    } finally {
      vi.stubGlobal("structuredClone", originalStructuredClone);
    }
  });

  describe.each(["commit", "fail"] as const)("%s snapshot validation", (transition) => {
    it("rejects a custom clock Date subclass without changing the active reservation", async () => {
      class SnapshotDate extends Date {}

      let callCount = 0;
      const store = new InMemoryIdempotencyStore<string>({
        now: () => {
          callCount += 1;
          return callCount === 1
            ? new Date("2026-01-01T00:00:00.000Z")
            : new SnapshotDate("2026-01-01T00:00:01.000Z");
        },
      });
      const key = createKey({ key: `${transition}-custom-clock-date` });
      const reserved = await store.reserve(key);
      if (reserved.outcome !== "reserved") {
        throw new Error("expected a reservation");
      }

      const operation =
        transition === "commit"
          ? store.commit({
              key,
              reservationId: reserved.reservation.reservationId,
              response: "created",
            })
          : store.fail({
              key,
              reservationId: reserved.reservation.reservationId,
              retryable: false,
            });

      await expect(operation).rejects.toBeInstanceOf(InvalidIdempotencySnapshotProblem);

      const unchanged = await store.reserve(key);
      expect(unchanged.outcome).toBe("in-flight");
    });
  });

  describe.each(["commit", "fail"] as const)("%s key canonicalization", (transition) => {
    it("retains the reserved key fields when the transition key only matches storage identity", async () => {
      const store = new InMemoryIdempotencyStore<string>();
      const key = createKey({ key: `${transition}-canonical-key`, tenantId: "tenant-a" });
      const reserved = await store.reserve(key);
      if (reserved.outcome !== "reserved") {
        throw new Error("expected a reservation");
      }

      const alteredKey = {
        ...key,
        key: "altered-key",
        namespace: "altered-namespace",
        tenantId: "altered-tenant",
        scope: "global" as const,
        source: "request-fingerprint" as const,
        telemetryAttributes: {
          ...key.telemetryAttributes,
          "croco.idempotency.key": "altered-key",
          "croco.idempotency.namespace": "altered-namespace",
          "croco.idempotency.scope": "global" as const,
          "croco.idempotency.tenant_id": "altered-tenant",
          "croco.idempotency.source": "request-fingerprint" as const,
        },
      };

      const record =
        transition === "commit"
          ? await store.commit({
              key: alteredKey,
              reservationId: reserved.reservation.reservationId,
              response: "created",
            })
          : await store.fail({
              key: alteredKey,
              reservationId: reserved.reservation.reservationId,
              retryable: false,
            });

      expect(record).toMatchObject(key);
      const repeated = await store.reserve(key);
      expect(repeated).toMatchObject({ record: key });
    });
  });

  it("snapshots Float16Array values when available without skipping unsupported runtimes", async () => {
    if (FLOAT16_ARRAY_CONSTRUCTOR === null) {
      expect(getFloat16ArrayConstructor()).toBeNull();
      return;
    }

    const store = new InMemoryIdempotencyStore<Float16ArrayLike>();
    const key = createKey({ key: "float16-array-snapshot" });
    const reserved = await store.reserve(key);
    if (reserved.outcome !== "reserved") {
      throw new Error("expected a reservation");
    }

    const response = new FLOAT16_ARRAY_CONSTRUCTOR([1.5, -2.25]);
    const committed = await store.commit({
      key,
      reservationId: reserved.reservation.reservationId,
      response,
    });

    response[0] = 9;
    expect(Array.from(committed.response)).toEqual([1.5, -2.25]);
    committed.response[1] = 9;

    const replayed = await store.replay(key);
    expect(replayed).not.toBeNull();
    if (replayed !== null) {
      expect(Array.from(replayed.response)).toEqual([1.5, -2.25]);
    }
  });

  it("isolates reserved, in-flight, and failed records from caller mutation", async () => {
    const store = new InMemoryIdempotencyStore();
    const key = createKey({ key: "record-snapshots" });
    const reserveMetadata = { nested: { value: "reserved" } };
    const reserved = await store.reserve(key, { metadata: reserveMetadata });
    if (reserved.outcome !== "reserved") {
      throw new Error("expected a reservation");
    }

    reserveMetadata.nested.value = "mutated-input";
    (reserved.record.metadata.nested as { value: string }).value = "mutated-result";
    reserved.record.reservedAt.setUTCFullYear(2030);

    const inFlight = await store.reserve(key);
    expect(inFlight.outcome).toBe("in-flight");
    if (inFlight.outcome !== "in-flight") {
      throw new Error("expected an in-flight record");
    }
    expect(inFlight.record.metadata).toEqual({ nested: { value: "reserved" } });
    expect(inFlight.record.reservedAt.getUTCFullYear()).not.toBe(2030);

    (inFlight.record.metadata.nested as { value: string }).value = "mutated-in-flight";
    const failedMetadata = { failure: { attempt: 1 } };
    const problem = { code: "terminal", status: 422, detail: "original" };
    const failed = await store.fail({
      key,
      reservationId: reserved.reservation.reservationId,
      retryable: false,
      metadata: failedMetadata,
      problem,
    });

    failedMetadata.failure.attempt = 2;
    problem.detail = "mutated-input";
    (failed.metadata.failure as { attempt: number }).attempt = 3;
    if (failed.problem !== undefined) {
      (failed.problem as { detail: string }).detail = "mutated-result";
    }

    const repeated = await store.reserve(key);
    expect(repeated.outcome).toBe("failed");
    if (repeated.outcome === "failed") {
      expect(repeated.record.metadata).toEqual({
        nested: { value: "reserved" },
        failure: { attempt: 1 },
      });
      expect(repeated.record.problem).toEqual({
        code: "terminal",
        status: 422,
        detail: "original",
      });
    }
  });

  it("rejects unsupported snapshot values before changing store state", async () => {
    const store = new InMemoryIdempotencyStore<() => void>();
    const invalidMetadataKey = createKey({ key: "invalid-metadata-snapshot" });

    const metadataError = await store
      .reserve(invalidMetadataKey, { metadata: { callback: () => undefined } })
      .catch((cause: unknown) => cause);
    expect(metadataError).toBeInstanceOf(InvalidIdempotencySnapshotProblem);
    expect(metadataError).toMatchObject({
      code: "idempotency-core/invalid-snapshot",
      status: 422,
    });
    if (metadataError instanceof InvalidIdempotencySnapshotProblem) {
      expect(metadataError.toJSON()).toMatchObject({
        field: "metadata",
        constraint: "stable-structured-clone-compatible",
      });
    }
    expect(store.size).toBe(0);

    const key = createKey({ key: "invalid-response-snapshot" });
    const reserved = await store.reserve(key);
    if (reserved.outcome !== "reserved") {
      throw new Error("expected a reservation");
    }

    const responseError = await store
      .commit({
        key,
        reservationId: reserved.reservation.reservationId,
        response: () => undefined,
      })
      .catch((cause: unknown) => cause);
    expect(responseError).toBeInstanceOf(InvalidIdempotencySnapshotProblem);
    if (responseError instanceof InvalidIdempotencySnapshotProblem) {
      expect(responseError.toJSON()).toMatchObject({
        field: "response",
        constraint: "stable-structured-clone-compatible",
      });
    }

    const unchanged = await store.reserve(key);
    expect(unchanged.outcome).toBe("in-flight");
    if (unchanged.outcome === "in-flight") {
      expect(unchanged.record.reservationId).toBe(reserved.reservation.reservationId);
    }
  });

  it("rejects RegExp values whose lastIndex cannot survive structured cloning", async () => {
    const store = new InMemoryIdempotencyStore<RegExp>();
    const key = createKey({ key: "regexp-last-index" });
    const reserved = await store.reserve(key);
    if (reserved.outcome !== "reserved") {
      throw new Error("expected a reservation");
    }

    const response = /snapshot/gu;
    response.lastIndex = 1;
    await expect(
      store.commit({
        key,
        reservationId: reserved.reservation.reservationId,
        response,
      }),
    ).rejects.toMatchObject({
      code: "idempotency-core/invalid-snapshot",
      status: 422,
    });

    const unchanged = await store.reserve(key);
    expect(unchanged.outcome).toBe("in-flight");
  });

  it("rejects accessors without invoking them or changing unrelated store state", async () => {
    const store = new InMemoryIdempotencyStore();
    const existingKey = createKey({ key: "existing-before-accessor" });
    const existing = await store.reserve(existingKey);
    if (existing.outcome !== "reserved") {
      throw new Error("expected a reservation");
    }

    const getter = vi.fn(() => {
      store.clear();
      return "side effect";
    });
    const metadata = Object.defineProperty({}, "unsafe", {
      enumerable: true,
      get: getter,
    });

    await expect(
      store.reserve(createKey({ key: "accessor-snapshot" }), { metadata }),
    ).rejects.toBeInstanceOf(InvalidIdempotencySnapshotProblem);

    expect(getter).not.toHaveBeenCalled();

    class AccessorMap extends Map<unknown, unknown> {}
    class AccessorSet extends Set<unknown> {}
    for (const [label, createContainer] of [
      ["map", (nested: object) => new AccessorMap([["unsafe", nested]])],
      ["set", (nested: object) => new AccessorSet([nested])],
      [
        "cross-realm-map",
        (nested: object) => runInNewContext("new Map([['unsafe', nested]])", { nested }),
      ],
      ["cross-realm-set", (nested: object) => runInNewContext("new Set([nested])", { nested })],
    ] as const) {
      const nestedGetter = vi.fn(() => {
        store.clear();
        return "side effect";
      });
      const nested = Object.defineProperty({}, "unsafe", {
        enumerable: true,
        get: nestedGetter,
      });

      await expect(
        store.reserve(createKey({ key: `${label}-subclass-accessor-snapshot` }), {
          metadata: { container: createContainer(nested) },
        }),
      ).rejects.toBeInstanceOf(InvalidIdempotencySnapshotProblem);
      expect(nestedGetter).not.toHaveBeenCalled();
    }

    class AccessorBytes extends Uint8Array {}
    const bufferGetter = vi.fn(() => {
      store.clear();
      return new ArrayBuffer(1);
    });
    Object.defineProperty(AccessorBytes.prototype, "buffer", {
      get: bufferGetter,
    });
    await expect(
      store.reserve(createKey({ key: "typed-array-buffer-accessor-snapshot" }), {
        metadata: { bytes: new AccessorBytes([1]) },
      }),
    ).rejects.toBeInstanceOf(InvalidIdempotencySnapshotProblem);
    expect(bufferGetter).not.toHaveBeenCalled();

    const unchanged = await store.reserve(existingKey);
    expect(unchanged.outcome).toBe("in-flight");
    if (unchanged.outcome === "in-flight") {
      expect(unchanged.record.reservationId).toBe(existing.reservation.reservationId);
    }
  });

  it.each([
    {
      label: "shared memory",
      createResponse: () => ({ nested: new SharedArrayBuffer(4) }),
    },
    {
      label: "cross-realm shared typed array with a local prototype",
      createResponse: () => {
        const nested = runInNewContext("new Uint8Array(new SharedArrayBuffer(1))") as Uint8Array;
        Object.setPrototypeOf(nested, Uint8Array.prototype);
        return { nested };
      },
    },
    {
      label: "Buffer",
      createResponse: () => ({ nested: Buffer.from("response") }),
    },
    {
      label: "custom class",
      createResponse: () => ({ nested: new (class SnapshotResult {})() }),
    },
    {
      label: "Map subclass",
      createResponse: () => ({ nested: new (class SpecializedMap extends Map {})() }),
    },
    {
      label: "typed array subclass",
      createResponse: () => ({ nested: new (class SpecializedBytes extends Uint8Array {})([1]) }),
    },
    {
      label: "typed array custom property",
      createResponse: () => {
        const nested = new Uint8Array([1]) as Uint8Array & { extra?: { value: string } };
        nested.extra = { value: "not-cloned" };
        return { nested };
      },
    },
  ])(
    "rejects $label instead of returning a different TResult runtime shape",
    async ({ label, createResponse }) => {
      const store = new InMemoryIdempotencyStore<unknown>();
      const key = createKey({ key: `unsupported-${label}` });
      const reserved = await store.reserve(key);
      if (reserved.outcome !== "reserved") {
        throw new Error("expected a reservation");
      }

      await expect(
        store.commit({
          key,
          reservationId: reserved.reservation.reservationId,
          response: createResponse(),
        }),
      ).rejects.toMatchObject({
        code: "idempotency-core/invalid-snapshot",
        status: 422,
      });

      const unchanged = await store.reserve(key);
      expect(unchanged.outcome).toBe("in-flight");
    },
  );

  it("preserves conflict and replay precedence when unused metadata cannot be snapshotted", async () => {
    const store = new InMemoryIdempotencyStore<{ ok: true }>();
    const key = createKey({ key: "snapshot-precedence", fingerprint: "payload-a" });
    const conflictingKey = createKey({
      key: "snapshot-precedence",
      fingerprint: "payload-b",
    });
    const reserved = await store.reserve(key);
    if (reserved.outcome !== "reserved") {
      throw new Error("expected a reservation");
    }

    await expect(
      store.reserve(conflictingKey, { metadata: { callback: () => undefined } }),
    ).rejects.toBeInstanceOf(IdempotencyConflictProblem);

    await store.commit({
      key,
      reservationId: reserved.reservation.reservationId,
      response: { ok: true },
    });

    const replay = await store.reserve(key, { metadata: { callback: () => undefined } });
    expect(replay.outcome).toBe("replay");
    if (replay.outcome === "replay") {
      expect(replay.response).toEqual({ ok: true });
    }
  });

  it("validates snapshot metadata before pruning unrelated expired records", async () => {
    let now = new Date("2026-01-01T00:00:00.000Z");
    const store = new InMemoryIdempotencyStore({ now: () => now });
    const staleKey = createKey({ key: "stale-before-invalid-snapshot" });
    const stale = await store.reserve(staleKey, { ttlMs: 1 });
    if (stale.outcome !== "reserved") {
      throw new Error("expected a reservation");
    }

    now = new Date("2026-01-01T00:00:00.001Z");
    await expect(
      store.reserve(createKey({ key: "invalid-snapshot" }), {
        metadata: { callback: () => undefined },
      }),
    ).rejects.toBeInstanceOf(InvalidIdempotencySnapshotProblem);

    await expect(
      store.commit({
        key: staleKey,
        reservationId: stale.reservation.reservationId,
        response: "stale",
      }),
    ).rejects.toBeInstanceOf(IdempotencyReservationExpiredProblem);
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
