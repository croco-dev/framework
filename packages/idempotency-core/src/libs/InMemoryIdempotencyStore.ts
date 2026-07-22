import {
  IdempotencyConflictProblem,
  IdempotencyReservationExpiredProblem,
  IdempotencyReservationNotFoundProblem,
  IdempotencyReservationStateProblem,
  InvalidIdempotencyTtlProblem,
} from "./problems/IdempotencyProblems";
import type {
  DerivedIdempotencyKey,
  IdempotencyCommitOptions,
  IdempotencyCompletedRecord,
  IdempotencyExpireOptions,
  IdempotencyFailOptions,
  IdempotencyFailedRecord,
  IdempotencyInFlightRecord,
  IdempotencyRecord,
  IdempotencyReserveOptions,
  IdempotencyReserveResult,
  IdempotencyStore,
} from "./types";

type Clock = () => Date;

export type InMemoryIdempotencyStoreOptions = {
  readonly now?: Clock;
};

export class InMemoryIdempotencyStore<TResult = unknown> implements IdempotencyStore<TResult> {
  private readonly records = new Map<string, IdempotencyRecord<TResult>>();
  private readonly now: Clock;
  private reservationSequence = 0;

  constructor(options: InMemoryIdempotencyStoreOptions = {}) {
    this.now = options.now ?? (() => new Date());
  }

  async reserve(
    key: DerivedIdempotencyKey,
    options: IdempotencyReserveOptions = {},
  ): Promise<IdempotencyReserveResult<TResult>> {
    const reservedAt = this.now();
    const recordExpiresAt = expiresAt(reservedAt, options.ttlMs);
    this.pruneExpired(reservedAt);

    const existing = this.records.get(key.storageKey);
    if (existing !== undefined) {
      this.assertSameFingerprint(existing, key);

      if (existing.status === "completed") {
        return {
          outcome: "replay",
          record: existing,
          response: existing.response,
        };
      }

      if (existing.status === "in-flight") {
        return {
          outcome: "in-flight",
          record: existing,
        };
      }

      if (!existing.retryable) {
        return {
          outcome: "failed",
          record: existing,
        };
      }
    }

    const record: IdempotencyInFlightRecord = {
      ...key,
      status: "in-flight",
      createdAt: reservedAt,
      updatedAt: reservedAt,
      expiresAt: recordExpiresAt,
      metadata: options.metadata ?? {},
      reservationId: this.nextReservationId(),
      reservedAt,
    };

    this.records.set(key.storageKey, record);

    return {
      outcome: "reserved",
      reservation: {
        storageKey: key.storageKey,
        reservationId: record.reservationId,
        key,
      },
      record,
    };
  }

  async commit(
    options: IdempotencyCommitOptions<TResult>,
  ): Promise<IdempotencyCompletedRecord<TResult>> {
    const completedAt = this.now();
    const recordExpiresAt = expiresAt(completedAt, options.ttlMs);
    const existing = this.records.get(options.key.storageKey);
    this.assertActiveReservation(existing, options.key, options.reservationId, completedAt);

    const record: IdempotencyCompletedRecord<TResult> = {
      ...options.key,
      status: "completed",
      createdAt: existing.createdAt,
      updatedAt: completedAt,
      expiresAt: recordExpiresAt,
      metadata: {
        ...existing.metadata,
        ...options.metadata,
      },
      completedAt,
      response: options.response,
    };

    this.records.set(options.key.storageKey, record);
    return record;
  }

  async replay(key: DerivedIdempotencyKey): Promise<IdempotencyCompletedRecord<TResult> | null> {
    this.pruneExpired();

    const existing = this.records.get(key.storageKey);
    if (existing === undefined) {
      return null;
    }

    this.assertSameFingerprint(existing, key);
    return existing.status === "completed" ? existing : null;
  }

  async fail(options: IdempotencyFailOptions): Promise<IdempotencyFailedRecord> {
    const failedAt = this.now();
    const recordExpiresAt = expiresAt(failedAt, options.ttlMs);
    const existing = this.records.get(options.key.storageKey);
    this.assertActiveReservation(existing, options.key, options.reservationId, failedAt);

    const record: IdempotencyFailedRecord = {
      ...options.key,
      status: "failed",
      createdAt: existing.createdAt,
      updatedAt: failedAt,
      expiresAt: recordExpiresAt,
      metadata: {
        ...existing.metadata,
        ...options.metadata,
      },
      failedAt,
      ...(options.problem === undefined ? {} : { problem: options.problem }),
      retryable: options.retryable ?? true,
    };

    this.records.set(options.key.storageKey, record);
    return record;
  }

  async expire(options: IdempotencyExpireOptions): Promise<boolean> {
    const existing = this.records.get(options.key.storageKey);
    if (existing === undefined) {
      return false;
    }

    this.assertSameFingerprint(existing, options.key);
    return this.records.delete(options.key.storageKey);
  }

  get size(): number {
    this.pruneExpired();
    return this.records.size;
  }

  clear(): void {
    this.records.clear();
  }

  private nextReservationId(): string {
    this.reservationSequence += 1;
    return `reservation-${this.reservationSequence}`;
  }

  private assertSameFingerprint(
    record: IdempotencyRecord<TResult>,
    key: DerivedIdempotencyKey,
  ): void {
    if (record.fingerprint === key.fingerprint) {
      return;
    }

    throw new IdempotencyConflictProblem({
      key: key.key,
      namespace: key.namespace,
      tenantId: key.tenantId,
    });
  }

  private assertActiveReservation(
    record: IdempotencyRecord<TResult> | undefined,
    key: DerivedIdempotencyKey,
    reservationId: string,
    observedAt: Date,
  ): asserts record is IdempotencyInFlightRecord {
    if (record === undefined) {
      throw new IdempotencyReservationNotFoundProblem({
        storageKey: key.storageKey,
        reservationId,
      });
    }

    this.assertSameFingerprint(record, key);

    if (record.status !== "in-flight") {
      throw new IdempotencyReservationStateProblem({
        storageKey: key.storageKey,
        expected: "in-flight",
        actual: record.status,
        reservationId,
      });
    }

    if (record.reservationId !== reservationId) {
      throw new IdempotencyReservationStateProblem({
        storageKey: key.storageKey,
        expected: record.reservationId,
        actual: reservationId,
        reservationId,
      });
    }

    if (record.expiresAt !== null && record.expiresAt.getTime() <= observedAt.getTime()) {
      throw new IdempotencyReservationExpiredProblem({
        expiredAt: record.expiresAt,
        observedAt,
      });
    }
  }

  private pruneExpired(observedAt = this.now()): void {
    const now = observedAt.getTime();

    for (const [storageKey, record] of this.records.entries()) {
      if (record.expiresAt !== null && record.expiresAt.getTime() <= now) {
        this.records.delete(storageKey);
      }
    }
  }
}

function expiresAt(from: Date, ttlMs: number | undefined): Date | null {
  if (ttlMs === undefined) {
    return null;
  }

  if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0) {
    throw new InvalidIdempotencyTtlProblem({
      constraint: "positive-safe-integer",
      receivedValue: toDiagnosticTtl(ttlMs),
    });
  }

  const expiration = new Date(from.getTime() + ttlMs);
  if (!Number.isFinite(expiration.getTime())) {
    throw new InvalidIdempotencyTtlProblem({
      constraint: "valid-date-range",
      receivedValue: ttlMs,
    });
  }

  return expiration;
}

function toDiagnosticTtl(ttlMs: number): number | string {
  if (Number.isFinite(ttlMs)) {
    return ttlMs;
  }
  if (Number.isNaN(ttlMs)) {
    return "NaN";
  }
  return ttlMs === Number.POSITIVE_INFINITY ? "Infinity" : "-Infinity";
}
