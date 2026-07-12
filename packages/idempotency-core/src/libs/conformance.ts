import {
  IdempotencyConflictProblem,
  InvalidIdempotencyTtlProblem,
} from "./problems/IdempotencyProblems";
import { deriveIdempotencyKey } from "./deriveIdempotencyKey";
import type { IdempotencyStore } from "./types";

export type IdempotencyStoreConformanceCase = {
  readonly name: string;
  run(): Promise<void>;
};

export type IdempotencyStoreConformanceOptions<TResult = string> = {
  readonly createStore: () => IdempotencyStore<TResult> | Promise<IdempotencyStore<TResult>>;
  readonly createResponse?: () => TResult;
};

export type IdempotencyStoreConformanceSuite = {
  readonly cases: readonly IdempotencyStoreConformanceCase[];
};

export function createIdempotencyStoreConformanceSuite<TResult = string>(
  options: IdempotencyStoreConformanceOptions<TResult>,
): IdempotencyStoreConformanceSuite {
  const createResponse = options.createResponse ?? (() => "stored-response" as TResult);

  return {
    cases: [
      {
        name: "replays a completed result for the same key and fingerprint",
        run: async () => {
          const store = await options.createStore();
          const key = deriveIdempotencyKey({
            namespace: "conformance",
            tenantId: "tenant-a",
            source: { kind: "explicit", key: "payment-1", fingerprint: "body-a" },
          });

          const reserved = await store.reserve(key);
          assertEqual(reserved.outcome, "reserved", "first reserve must create a reservation");
          if (reserved.outcome !== "reserved") {
            return;
          }

          const response = createResponse();
          await store.commit({
            key,
            reservationId: reserved.reservation.reservationId,
            response,
          });

          const replay = await store.reserve(key);
          assertEqual(replay.outcome, "replay", "completed records must replay");
          if (replay.outcome === "replay") {
            assertEqual(replay.response, response, "replay must return the committed response");
          }
        },
      },
      {
        name: "reserves one winner under concurrent attempts for the same key",
        run: async () => {
          const store = await options.createStore();
          const key = deriveIdempotencyKey({
            namespace: "conformance",
            source: { kind: "explicit", key: "concurrent-job-1", fingerprint: "payload-a" },
          });

          const results = await Promise.all([
            store.reserve(key),
            store.reserve(key),
            store.reserve(key),
          ]);
          const reservedCount = results.filter((result) => result.outcome === "reserved").length;
          const inFlightCount = results.filter((result) => result.outcome === "in-flight").length;

          assertEqual(reservedCount, 1, "concurrent reserve attempts must create one winner");
          assertEqual(
            inFlightCount,
            2,
            "concurrent reserve attempts must report remaining work as in-flight",
          );
        },
      },
      {
        name: "reports in-flight state while the first reservation is active",
        run: async () => {
          const store = await options.createStore();
          const key = deriveIdempotencyKey({
            namespace: "conformance",
            source: { kind: "explicit", key: "job-1", fingerprint: "payload-a" },
          });

          const first = await store.reserve(key);
          assertEqual(first.outcome, "reserved", "first reserve must be active");

          const second = await store.reserve(key);
          assertEqual(second.outcome, "in-flight", "second reserve must see in-flight work");
        },
      },
      {
        name: "throws a Problem when the same key has a different fingerprint",
        run: async () => {
          const store = await options.createStore();
          const key = deriveIdempotencyKey({
            namespace: "conformance",
            source: { kind: "explicit", key: "payment-2", fingerprint: "body-a" },
          });
          const conflictingKey = deriveIdempotencyKey({
            namespace: "conformance",
            source: { kind: "explicit", key: "payment-2", fingerprint: "body-b" },
          });

          await store.reserve(key);
          await assertRejects(() => store.reserve(conflictingKey), IdempotencyConflictProblem);
        },
      },
      {
        name: "isolates the same key across tenant namespaces",
        run: async () => {
          const store = await options.createStore();
          const tenantAKey = deriveIdempotencyKey({
            namespace: "conformance",
            tenantId: "tenant-a",
            source: { kind: "explicit", key: "shared", fingerprint: "body-a" },
          });
          const tenantBKey = deriveIdempotencyKey({
            namespace: "conformance",
            tenantId: "tenant-b",
            source: { kind: "explicit", key: "shared", fingerprint: "body-b" },
          });

          const tenantA = await store.reserve(tenantAKey);
          const tenantB = await store.reserve(tenantBKey);

          assertEqual(tenantA.outcome, "reserved", "tenant A must reserve independently");
          assertEqual(tenantB.outcome, "reserved", "tenant B must reserve independently");
        },
      },
      {
        name: "expires records by key and allows a fresh reservation",
        run: async () => {
          const store = await options.createStore();
          const key = deriveIdempotencyKey({
            namespace: "conformance",
            source: { kind: "explicit", key: "expiring", fingerprint: "body-a" },
          });

          const reserved = await store.reserve(key);
          assertEqual(reserved.outcome, "reserved", "first reserve must create a reservation");

          const expired = await store.expire({ key });
          assertEqual(expired, true, "expire must remove an existing record");

          const fresh = await store.reserve(key);
          assertEqual(fresh.outcome, "reserved", "expired record must allow new reservation");
        },
      },
      {
        name: "rejects invalid ttl before reserve state changes",
        run: async () => {
          const store = await options.createStore();
          const key = createConformanceKey("invalid-reserve-ttl");

          await assertRejects(() => store.reserve(key, { ttlMs: 0 }), InvalidIdempotencyTtlProblem);
          const reserved = await store.reserve(key);
          assertEqual(reserved.outcome, "reserved", "invalid reserve TTL must not create a record");
        },
      },
      {
        name: "rejects invalid ttl before commit state changes",
        run: async () => {
          const store = await options.createStore();
          const key = createConformanceKey("invalid-commit-ttl");
          const reserved = await store.reserve(key);
          assertEqual(reserved.outcome, "reserved", "commit conformance requires a reservation");
          if (reserved.outcome !== "reserved") {
            return;
          }

          await assertRejects(
            () =>
              store.commit({
                key,
                reservationId: reserved.reservation.reservationId,
                response: createResponse(),
                ttlMs: 0,
              }),
            InvalidIdempotencyTtlProblem,
          );
          const inFlight = await store.reserve(key);
          assertEqual(
            inFlight.outcome,
            "in-flight",
            "invalid commit TTL must preserve the reservation",
          );
        },
      },
      {
        name: "rejects invalid ttl before fail state changes",
        run: async () => {
          const store = await options.createStore();
          const key = createConformanceKey("invalid-fail-ttl");
          const reserved = await store.reserve(key);
          assertEqual(reserved.outcome, "reserved", "fail conformance requires a reservation");
          if (reserved.outcome !== "reserved") {
            return;
          }

          await assertRejects(
            () =>
              store.fail({
                key,
                reservationId: reserved.reservation.reservationId,
                problem: { code: "conformance", status: 503 },
                ttlMs: 0,
              }),
            InvalidIdempotencyTtlProblem,
          );
          const inFlight = await store.reserve(key);
          assertEqual(
            inFlight.outcome,
            "in-flight",
            "invalid fail TTL must preserve the reservation",
          );
        },
      },
      {
        name: "keeps expiration absent when ttl is omitted",
        run: async () => {
          const store = await options.createStore();
          const commitKey = createConformanceKey("omitted-commit-ttl");
          const commitReservation = await store.reserve(commitKey);
          assertEqual(commitReservation.outcome, "reserved", "commit requires a reservation");
          if (commitReservation.outcome !== "reserved") {
            return;
          }
          assertEqual(commitReservation.record.expiresAt, null, "reserve TTL must remain absent");

          const completed = await store.commit({
            key: commitKey,
            reservationId: commitReservation.reservation.reservationId,
            response: createResponse(),
          });
          assertEqual(completed.expiresAt, null, "commit TTL must remain absent");

          const failKey = createConformanceKey("omitted-fail-ttl");
          const failReservation = await store.reserve(failKey);
          assertEqual(failReservation.outcome, "reserved", "fail requires a reservation");
          if (failReservation.outcome !== "reserved") {
            return;
          }
          const failed = await store.fail({
            key: failKey,
            reservationId: failReservation.reservation.reservationId,
            problem: { code: "conformance", status: 503 },
          });
          assertEqual(failed.expiresAt, null, "fail TTL must remain absent");
        },
      },
    ],
  };
}

function createConformanceKey(key: string) {
  return deriveIdempotencyKey({
    namespace: "conformance",
    source: { kind: "explicit", key, fingerprint: "payload-a" },
  });
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}.`);
  }
}

async function assertRejects(fn: () => Promise<unknown>, expected: Function): Promise<void> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof expected) {
      return;
    }

    throw new Error(
      `Expected ${expected.name}, got ${error instanceof Error ? error.name : String(error)}.`,
    );
  }

  throw new Error(`Expected ${expected.name} to be thrown.`);
}
