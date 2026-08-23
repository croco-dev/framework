import {
  IdempotencyConflictProblem,
  IdempotencyReservationExpiredProblem,
  IdempotencyReservationNotFoundProblem,
  IdempotencyReservationStateProblem,
  InvalidIdempotencySnapshotProblem,
  InvalidIdempotencyTtlProblem,
} from "./problems/IdempotencyProblems";
import type { IdempotencySnapshotField } from "./problems/IdempotencyProblems";
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

const FLOAT16_ARRAY_PROTOTYPE = getFloat16ArrayPrototype();

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
    const existing = this.records.get(key.storageKey);
    if (existing !== undefined && !isExpired(existing, reservedAt)) {
      this.assertSameFingerprint(existing, key);

      if (existing.status === "completed") {
        this.pruneExpired(reservedAt);
        return snapshotValue({
          outcome: "replay",
          record: existing,
          response: existing.response,
        });
      }

      if (existing.status === "in-flight") {
        this.pruneExpired(reservedAt);
        return snapshotValue({
          outcome: "in-flight",
          record: existing,
        });
      }

      if (!existing.retryable) {
        this.pruneExpired(reservedAt);
        return snapshotValue({
          outcome: "failed",
          record: existing,
        });
      }
    }

    const metadata = snapshotValue(options.metadata ?? {}, "metadata");
    this.pruneExpired(reservedAt);

    const record: IdempotencyInFlightRecord = {
      ...key,
      status: "in-flight",
      createdAt: reservedAt,
      updatedAt: reservedAt,
      expiresAt: recordExpiresAt,
      metadata,
      reservationId: this.nextReservationId(),
      reservedAt,
    };

    const storedRecord = snapshotValue(record);
    this.records.set(key.storageKey, storedRecord);

    return snapshotValue({
      outcome: "reserved",
      reservation: {
        storageKey: key.storageKey,
        reservationId: record.reservationId,
        key,
      },
      record: storedRecord,
    });
  }

  async commit(
    options: IdempotencyCommitOptions<TResult>,
  ): Promise<IdempotencyCompletedRecord<TResult>> {
    const completedAt = snapshotDateValue(this.now());
    const recordExpiresAt = expiresAt(completedAt, options.ttlMs);
    const existing = this.records.get(options.key.storageKey);
    this.assertActiveReservation(existing, options.key, options.reservationId, completedAt);
    const metadata = snapshotValue(options.metadata ?? {}, "metadata");
    const response = snapshotValue(options.response, "response");

    const record: IdempotencyCompletedRecord<TResult> = {
      ...keyFromRecord(existing),
      status: "completed",
      createdAt: existing.createdAt,
      updatedAt: completedAt,
      expiresAt: recordExpiresAt,
      metadata: {
        ...existing.metadata,
        ...metadata,
      },
      completedAt,
      response,
    };

    const storedRecord = cloneValidatedValue(record, "record");
    this.records.set(options.key.storageKey, storedRecord);
    return record;
  }

  async replay(key: DerivedIdempotencyKey): Promise<IdempotencyCompletedRecord<TResult> | null> {
    this.pruneExpired();

    const existing = this.records.get(key.storageKey);
    if (existing === undefined) {
      return null;
    }

    this.assertSameFingerprint(existing, key);
    return existing.status === "completed" ? snapshotValue(existing) : null;
  }

  async fail(options: IdempotencyFailOptions): Promise<IdempotencyFailedRecord> {
    const failedAt = snapshotDateValue(this.now());
    const recordExpiresAt = expiresAt(failedAt, options.ttlMs);
    const existing = this.records.get(options.key.storageKey);
    this.assertActiveReservation(existing, options.key, options.reservationId, failedAt);
    const metadata = snapshotValue(options.metadata ?? {}, "metadata");
    const problem =
      options.problem === undefined ? undefined : snapshotValue(options.problem, "problem");

    const record: IdempotencyFailedRecord = {
      ...keyFromRecord(existing),
      status: "failed",
      createdAt: existing.createdAt,
      updatedAt: failedAt,
      expiresAt: recordExpiresAt,
      metadata: {
        ...existing.metadata,
        ...metadata,
      },
      failedAt,
      ...(problem === undefined ? {} : { problem }),
      retryable: options.retryable ?? true,
    };

    const storedRecord = cloneValidatedValue(record, "record");
    this.records.set(options.key.storageKey, storedRecord);
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

function snapshotValue<T>(value: T, field: IdempotencySnapshotField = "record"): T {
  try {
    assertSnapshotPreflight(value, field);
    const snapshot = cloneValidatedValue(value, field);
    assertStableSnapshot(value, snapshot, field);
    return snapshot;
  } catch (cause) {
    throwInvalidSnapshot(cause, field);
  }
}

function cloneValidatedValue<T>(value: T, field: IdempotencySnapshotField): T {
  try {
    return structuredClone(value);
  } catch (cause) {
    throwInvalidSnapshot(cause, field);
  }
}

function snapshotDateValue(value: Date): Date {
  try {
    if (Object.getPrototypeOf(value) !== Date.prototype || Reflect.ownKeys(value).length !== 0) {
      throw new InvalidIdempotencySnapshotProblem({ field: "record" });
    }
    return new Date(Date.prototype.getTime.call(value));
  } catch (cause) {
    throwInvalidSnapshot(cause, "record");
  }
}

function throwInvalidSnapshot(cause: unknown, field: IdempotencySnapshotField): never {
  if (cause instanceof InvalidIdempotencySnapshotProblem) {
    throw cause;
  }
  throw new InvalidIdempotencySnapshotProblem({
    field,
    ...(cause instanceof Error ? { cause } : {}),
  });
}

function assertSnapshotPreflight(
  value: unknown,
  field: IdempotencySnapshotField,
  seen = new WeakSet<object>(),
): void {
  if (value === null || typeof value !== "object") {
    if (typeof value === "function" || typeof value === "symbol") {
      throw new InvalidIdempotencySnapshotProblem({ field });
    }
    return;
  }

  if (seen.has(value)) {
    return;
  }
  seen.add(value);

  if (isSharedArrayBuffer(value)) {
    throw new InvalidIdempotencySnapshotProblem({ field });
  }
  if (ArrayBuffer.isView(value)) {
    if (!isSupportedArrayBufferViewPrototype(Object.getPrototypeOf(value))) {
      throw new InvalidIdempotencySnapshotProblem({ field });
    }
    if (isSharedArrayBuffer(getArrayBufferViewBuffer(value, field))) {
      throw new InvalidIdempotencySnapshotProblem({ field });
    }
  }

  const mapEntries = getMapEntries(value);
  if (mapEntries !== null) {
    if (Object.getPrototypeOf(value) !== Map.prototype) {
      throw new InvalidIdempotencySnapshotProblem({ field });
    }
    for (const [entryKey, entryValue] of mapEntries) {
      assertSnapshotPreflight(entryKey, field, seen);
      assertSnapshotPreflight(entryValue, field, seen);
    }
  } else {
    const setEntries = getSetEntries(value);
    if (setEntries !== null && Object.getPrototypeOf(value) !== Set.prototype) {
      throw new InvalidIdempotencySnapshotProblem({ field });
    }
    if (setEntries !== null) {
      for (const entryValue of setEntries) {
        assertSnapshotPreflight(entryValue, field, seen);
      }
    }
  }

  for (const propertyKey of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, propertyKey);
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new InvalidIdempotencySnapshotProblem({ field });
    }
    assertSnapshotPreflight(descriptor.value, field, seen);
  }
}

function getMapEntries(value: object): MapIterator<[unknown, unknown]> | null {
  try {
    return Map.prototype.entries.call(value) as MapIterator<[unknown, unknown]>;
  } catch {
    return null;
  }
}

function getSetEntries(value: object): SetIterator<unknown> | null {
  try {
    return Set.prototype.values.call(value) as SetIterator<unknown>;
  } catch {
    return null;
  }
}

function assertStableSnapshot(
  source: unknown,
  snapshot: unknown,
  field: IdempotencySnapshotField,
  seen = new WeakMap<object, object>(),
): void {
  if (source === null || typeof source !== "object") {
    if (!Object.is(source, snapshot)) {
      throw new InvalidIdempotencySnapshotProblem({ field });
    }
    return;
  }
  if (snapshot === null || typeof snapshot !== "object") {
    throw new InvalidIdempotencySnapshotProblem({ field });
  }

  if (
    isSharedArrayBuffer(source) ||
    (ArrayBuffer.isView(source) && isSharedArrayBuffer(getArrayBufferViewBuffer(source, field)))
  ) {
    throw new InvalidIdempotencySnapshotProblem({ field });
  }

  const seenSnapshot = seen.get(source);
  if (seenSnapshot !== undefined) {
    if (seenSnapshot !== snapshot) {
      throw new InvalidIdempotencySnapshotProblem({ field });
    }
    return;
  }
  seen.set(source, snapshot);

  if (Object.getPrototypeOf(source) !== Object.getPrototypeOf(snapshot)) {
    throw new InvalidIdempotencySnapshotProblem({ field });
  }

  if (source instanceof Date && snapshot instanceof Date) {
    if (!Object.is(source.getTime(), snapshot.getTime())) {
      throw new InvalidIdempotencySnapshotProblem({ field });
    }
  } else if (source instanceof Map && snapshot instanceof Map) {
    if (source.size !== snapshot.size) {
      throw new InvalidIdempotencySnapshotProblem({ field });
    }
    const sourceEntries = source.entries();
    const snapshotEntries = snapshot.entries();
    for (let index = 0; index < source.size; index += 1) {
      const sourceEntry = sourceEntries.next();
      const snapshotEntry = snapshotEntries.next();
      if (sourceEntry.done || snapshotEntry.done) {
        throw new InvalidIdempotencySnapshotProblem({ field });
      }
      assertStableSnapshot(sourceEntry.value[0], snapshotEntry.value[0], field, seen);
      assertStableSnapshot(sourceEntry.value[1], snapshotEntry.value[1], field, seen);
    }
  } else if (source instanceof Set && snapshot instanceof Set) {
    if (source.size !== snapshot.size) {
      throw new InvalidIdempotencySnapshotProblem({ field });
    }
    const sourceEntries = source.values();
    const snapshotEntries = snapshot.values();
    for (let index = 0; index < source.size; index += 1) {
      const sourceEntry = sourceEntries.next();
      const snapshotEntry = snapshotEntries.next();
      if (sourceEntry.done || snapshotEntry.done) {
        throw new InvalidIdempotencySnapshotProblem({ field });
      }
      assertStableSnapshot(sourceEntry.value, snapshotEntry.value, field, seen);
    }
  } else if (source instanceof ArrayBuffer && snapshot instanceof ArrayBuffer) {
    assertSameBytes(new Uint8Array(source), new Uint8Array(snapshot), field);
  } else if (ArrayBuffer.isView(source) && ArrayBuffer.isView(snapshot)) {
    assertSameBytes(
      new Uint8Array(getArrayBufferViewBuffer(source, field), source.byteOffset, source.byteLength),
      new Uint8Array(
        getArrayBufferViewBuffer(snapshot, field),
        snapshot.byteOffset,
        snapshot.byteLength,
      ),
      field,
    );
  }

  const sourceKeys = Reflect.ownKeys(source);
  const snapshotKeys = Reflect.ownKeys(snapshot);
  if (sourceKeys.length !== snapshotKeys.length) {
    throw new InvalidIdempotencySnapshotProblem({ field });
  }

  for (let index = 0; index < sourceKeys.length; index += 1) {
    const sourceKey = sourceKeys[index];
    const snapshotKey = snapshotKeys[index];
    if (sourceKey !== snapshotKey || sourceKey === undefined) {
      throw new InvalidIdempotencySnapshotProblem({ field });
    }

    const sourceDescriptor = Object.getOwnPropertyDescriptor(source, sourceKey);
    const snapshotDescriptor = Object.getOwnPropertyDescriptor(snapshot, sourceKey);
    if (
      sourceDescriptor === undefined ||
      snapshotDescriptor === undefined ||
      sourceDescriptor.enumerable !== snapshotDescriptor.enumerable ||
      "value" in sourceDescriptor !== "value" in snapshotDescriptor ||
      !("value" in sourceDescriptor) ||
      !("value" in snapshotDescriptor)
    ) {
      throw new InvalidIdempotencySnapshotProblem({ field });
    }
    assertStableSnapshot(sourceDescriptor.value, snapshotDescriptor.value, field, seen);
  }
}

function assertSameBytes(
  source: Uint8Array,
  snapshot: Uint8Array,
  field: IdempotencySnapshotField,
): void {
  if (source.byteLength !== snapshot.byteLength) {
    throw new InvalidIdempotencySnapshotProblem({ field });
  }
  for (let index = 0; index < source.byteLength; index += 1) {
    if (source[index] !== snapshot[index]) {
      throw new InvalidIdempotencySnapshotProblem({ field });
    }
  }
}

function isSharedArrayBuffer(value: unknown): value is SharedArrayBuffer {
  if (typeof SharedArrayBuffer === "undefined" || value === null || typeof value !== "object") {
    return false;
  }

  const byteLengthGetter = Object.getOwnPropertyDescriptor(
    SharedArrayBuffer.prototype,
    "byteLength",
  )?.get;
  if (byteLengthGetter === undefined) {
    return false;
  }

  try {
    Reflect.apply(byteLengthGetter, value, []);
    return true;
  } catch {
    return false;
  }
}

function isSupportedArrayBufferViewPrototype(prototype: object | null): boolean {
  return (
    prototype === DataView.prototype ||
    prototype === Int8Array.prototype ||
    prototype === Uint8Array.prototype ||
    prototype === Uint8ClampedArray.prototype ||
    prototype === Int16Array.prototype ||
    prototype === Uint16Array.prototype ||
    prototype === Int32Array.prototype ||
    prototype === Uint32Array.prototype ||
    prototype === Float32Array.prototype ||
    prototype === Float64Array.prototype ||
    (FLOAT16_ARRAY_PROTOTYPE !== null && prototype === FLOAT16_ARRAY_PROTOTYPE) ||
    prototype === BigInt64Array.prototype ||
    prototype === BigUint64Array.prototype
  );
}

function getFloat16ArrayPrototype(): object | null {
  const constructor = Reflect.get(globalThis, "Float16Array");
  if (typeof constructor !== "function") {
    return null;
  }

  const prototype = Reflect.get(constructor, "prototype");
  return prototype !== null && typeof prototype === "object" ? prototype : null;
}

function getArrayBufferViewBuffer(
  value: ArrayBufferView,
  field: IdempotencySnapshotField,
): ArrayBufferLike {
  const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype) as object;
  const typedArrayBufferGetter = Object.getOwnPropertyDescriptor(
    typedArrayPrototype,
    "buffer",
  )?.get;
  const typedArrayBuffer = applyArrayBufferViewGetter(typedArrayBufferGetter, value);
  if (typedArrayBuffer !== null) {
    return typedArrayBuffer;
  }

  const dataViewBufferGetter = Object.getOwnPropertyDescriptor(DataView.prototype, "buffer")?.get;
  const dataViewBuffer = applyArrayBufferViewGetter(dataViewBufferGetter, value);
  if (dataViewBuffer !== null) {
    return dataViewBuffer;
  }

  throw new InvalidIdempotencySnapshotProblem({ field });
}

function applyArrayBufferViewGetter(
  getter: (() => ArrayBufferLike) | undefined,
  value: ArrayBufferView,
): ArrayBufferLike | null {
  if (getter === undefined) {
    return null;
  }
  try {
    return Reflect.apply(getter, value, []) as ArrayBufferLike;
  } catch {
    return null;
  }
}

function isExpired(record: IdempotencyRecord<unknown>, observedAt: Date): boolean {
  return record.expiresAt !== null && record.expiresAt.getTime() <= observedAt.getTime();
}

function keyFromRecord(record: IdempotencyRecord<unknown>): DerivedIdempotencyKey {
  return {
    key: record.key,
    fingerprint: record.fingerprint,
    namespace: record.namespace,
    tenantId: record.tenantId,
    scope: record.scope,
    source: record.source,
    storageKey: record.storageKey,
    telemetryAttributes: record.telemetryAttributes,
  };
}
